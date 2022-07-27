const amqp = require('amqplib');
const { getDbInstance } = require('../lib/mongo');
const { ObjectId, GridFSBucket } = require('mongodb')
var jimp = require('jimp');
const fs = require('fs')



const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost'
const rabbitmqUrl = `amqp://${rabbitmqHost}`;

function getPhotoDownloadStreamByFilename(filename) {
  console.log("filename: ", filename)
  const db = getDbInstance();
  const bucket = new GridFSBucket(db, { bucketName: 'photos' });
  //console.log(bucket.find({filename: filename}))
  res = bucket.openDownloadStreamByName(filename);
  console.log(res)
  return res
}

async function getPhotoById(id) {
    const db = getDbInstance()
    //const collection = db.collection('photos')
    console.log(db)
    const bucket = new GridFSBucket(db, { bucketName: 'photos' });
    const photo = await bucket.find({ _id: new ObjectId(id) }).toArray();


    //const photo = await collection.find({_id: ObjectId(id)}).toArray()
    return photo[0]
}

async function insertNewPhoto(thumb) {
    const db = getDbInstance()
    const bucket = new GridFSBucket(db, { bucketName: 'photos' });

    //review = extractValidFields(review, reviewSchema)
    const result = await bucket.insertOne(thumb)
    return result.insertedId
}

async function modifyPhoto(id, photo) {
    const db = getDbInstance()
    const collection = db.collection('photos')
    photo.businessid = ObjectId(photo.businessid)

    const result = await collection.replaceOne(
      { _id: new ObjectId(id) },
      photo
    )
    return result.matchedCount > 0
}

async function main() {
  const connection = await amqp.connect(rabbitmqUrl);
  const channel = await connection.createChannel();
  await channel.assertQueue('photo');

  channel.consume('photo', (msg) => {
  if (msg) {
    console.log(msg.content.toString());
    const photo = getPhotoById(msg)
    // jimp.read('./uploads/' + photo.filename)
    //   .then(image => {
    //     // Do stuff with the image.
    //     image.resize(100, 100)
    //     iamge.write('./uploads/' + photo.filename)
    //   })
    //   .catch(err => {
    //     // Handle an exception.
    //   });

  }
  channel.ack(msg);
  });

}
main();