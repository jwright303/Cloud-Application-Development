const amqp = require('amqplib');
const { getDbInstance, connectToDb } = require('./lib/mongo');
const { ObjectId, GridFSBucket } = require('mongodb')
var jimp = require('jimp');
const fs = require('fs')



const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost'
const rabbitmqUrl = `amqp://${rabbitmqHost}`;

// Function for reamoving a file that is temporairly stored in Uplaods directory
function removeUploadedFile(file) {
  return new Promise((resolve, reject) => {
    fs.unlink(file, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Function to get a download stream for a file from GridFS
function getPhotoDownloadStreamByFilename(filename) {
  const db = getDbInstance();
  const bucket = new GridFSBucket(db, { bucketName: 'photos' });
  res = bucket.openDownloadStreamByName(filename);
  return res
}

// Function that saves a photo file - used to save the thumbnails in GridFS
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

// Function to grab a photo entity which contains other information we need
async function getPhotoById(id) {
    const db = getDbInstance()

    const bucket = new GridFSBucket(db, { bucketName: 'photos' });
    const photo = await bucket.find({ _id: ObjectId(id) }).toArray();

    return photo[0]
}

// inserts the new thumbnail into the database
async function insertNewPhoto(thumb) {
    const db = getDbInstance()
    const bucket = new GridFSBucket(db, { bucketName: 'photos' });

    const result = await bucket.insertOne(thumb)
    return result.insertedId
}

// Main funciton that consumes things from the queue
async function main() {
  const connection = await amqp.connect(rabbitmqUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue('photo');

  // Consume a item on the photo queue
  channel.consume('photo', async function (msg) {
    if (msg) {
      console.log(msg.content.toString());
      const id = msg.content.toString()
      const photo = await getPhotoById(id)
      console.log(photo)

      // used jimp to resize the image for the thumbnail capabilities
      jimp.read('./uploads/' + photo.filename)
        .then(async function (image) {
          image.resize(100, 100)
          image.write('./uploads/' + photo.filename)

          const thumb = {
            contentType: photo.metadata.contentType,
            filename: photo.filename,
            path: './uploads/' + photo.filename
          };
          // Store the thumbnail in GridFS - link it to the origional photo as well
          const tid = await saveImageFile(thumb, photo._id.toString())
          photo.metadata.thumbId = tid

          removeUploadedFile('./uploads/' + photo.filename)
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