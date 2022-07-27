const amqp = require('amqplib');
const { getDbInstance, connectToDb } = require('./lib/mongo');
const { ObjectId, GridFSBucket } = require('mongodb')
var jimp = require('jimp');
const fs = require('fs')



const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost'
const rabbitmqUrl = `amqp://${rabbitmqHost}`;

function getPhotoDownloadStreamByFilename(filename) {
  const db = getDbInstance();
  const bucket = new GridFSBucket(db, { bucketName: 'photos' });
  res = bucket.openDownloadStreamByName(filename);
  return res
}

function saveImageFile(thumb, pid) {
  return new Promise((resolve, reject) => {
    const db = getDbInstance();
    const bucket = new GridFSBucket(db, { bucketName: 'thumbs' });
    const metadata = {
      contentType: thumb.contentType,
      photoid: pid
    };
    const uploadStream = bucket.openUploadStream(
      thumb.filename,
      { metadata: metadata }
    );
    fs.createReadStream(thumb.path).pipe(uploadStream)
      .on('error', (err) => {
        reject(err);
      })
      .on('finish', (result) => {
        resolve(result._id);
      });
  });
}

async function getPhotoById(id) {
    const db = getDbInstance()

    const bucket = new GridFSBucket(db, { bucketName: 'photos' });
    const photo = await bucket.find({ _id: ObjectId(id) }).toArray();

    return photo[0]
}

async function insertNewPhoto(thumb) {
    const db = getDbInstance()
    const bucket = new GridFSBucket(db, { bucketName: 'photos' });

    const result = await bucket.insertOne(thumb)
    return result.insertedId
}

async function main() {
  const connection = await amqp.connect(rabbitmqUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue('photo');

  channel.consume('photo', async function (msg) {
    if (msg) {
      console.log(msg.content.toString());
      const id = msg.content.toString()
      const photo = await getPhotoById(id)
      console.log(photo)
      jimp.read('./uploads/' + photo.filename)
        .then(async function (image) {
          image.resize(100, 100)
          image.write('./uploads/' + photo.filename)

          const thumb = {
            contentType: photo.metadata.contentType,
            filename: photo.filename,
            path: './uploads/' + photo.filename
          };

          const tid = await saveImageFile(thumb, photo._id.toString())
          photo.metadata.thumbId = tid
        })
        .catch(err => {
          console.log(err)
        });

    }
    channel.ack(msg);
  });
}

connectToDb(function () {
  console.log("connecting to db")
  main()
})