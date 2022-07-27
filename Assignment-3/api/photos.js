const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto')
const fs = require('fs')
path = require('path')


const { ObjectId, GridFSBucket } = require('mongodb')

const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const { requireAuthentication } = require('../lib/auth');

const { getDbInstance } = require('../lib/mongo');

const photos = require('../data/photos');

const amqp = require('amqplib');
const rabbitmqHost = process.env.RABBITMQ_HOST || 'localhost'
const rabbitmqUrl = `amqp://${rabbitmqHost}`;

exports.router = router;
exports.photos = photos;


/* 
 * Note: This endpoint uses very similar functionality found in businesses.js and reviews.js
 * For more detailed documentation see those files
 */

// Supported file types
const fileTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png'
}

// Storing the files as they come in in the uploads directory for temporary storage
pth = path.join(__dirname, '..', 'uploads')
const upload = multer({ 
  storage: multer.diskStorage({
    destination: pth,
    filename: (req, file, callback) => {
      const filename =
      crypto.pseudoRandomBytes(16).toString('hex');
      const extension = fileTypes[file.mimetype];
      callback(null, `${filename}.${extension}`);
    }
  }),
  //Checks to see if it is a supported file type
  fileFilter: (req, file, callback) => {
  callback(null, !!fileTypes[file.mimetype]);
  }
})

// Removes the file that is being temporarily stored in the uploads directory
function removeUploadedFile(file) {
  return new Promise((resolve, reject) => {
    fs.unlink(file.path, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

// Function to save a photo file into gridfs - this replaces the insert photo function for the normal collection
function saveImageFile(photo) {
  return new Promise((resolve, reject) => {
    const db = getDbInstance();
    const bucket = new GridFSBucket(db, { bucketName: 'photos' });
    const metadata = {
      contentType: photo.contentType,
      caption: photo.caption,
      userid: photo.userid,
      businessid: photo.businessid
    };
    const uploadStream = bucket.openUploadStream(
      photo.filename,
      { metadata: metadata }
    );
    //Reads in the file from the uploads directory 
    fs.createReadStream(photo.path).pipe(uploadStream)
      .on('error', (err) => {
        reject(err);
      })
      .on('finish', (result) => {
        resolve(result._id);
      });
  });
}

// Function for adding things to the RabbitMQ queue - sends over the id of the photo in GridFS
async function producePhoto(name) {
  try {
    const connection = await amqp.connect(rabbitmqUrl);
    const channel = await connection.createChannel();
    await channel.assertQueue('photo');
    
    channel.sendToQueue('photo', Buffer.from(name));
    setTimeout(() => { connection.close(); }, 500);

  } catch (err) {
    console.error(err);
  }
}


// exports.getPhotoDownloadStreamByFilename = function (filename) {
//   const db = getDBReference();
//   const bucket =
//     new GridFSBucket(db, { bucketName: 'photos' });
//   return bucket.openDownloadStreamByName(filename);
// }



/*
 * Schema describing required/optional fields of a photo object.
 */
const photoSchema = {
  userid: { required: true },
  businessid: { required: true },
  caption: { required: false }
};

async function removePhoto(id) {
  const db = getDbInstance()
  const collection = db.collection('photos')
  const conf = await collection.deleteOne({_id: new ObjectId(id)})
  return conf.deletedCount > 0
}

async function insertNewPhoto(photo) {
    const db = getDbInstance()
    photo.businessid = ObjectId(photo.businessid)
    //photo.userid = ObjectId(photo.userid)


    var collection = db.collection('businesses')
    const existingB = await collection.find({_id: photo.businessid})
    if (!existingB) {
      return null
    }

    collection = db.collection('photos')

    //review = extractValidFields(review, reviewSchema)
    const result = await collection.insertOne(photo)
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

async function getThumbById(id) {
    const db = getDbInstance()
    //const collection = db.collection('photos')

    const bucket = new GridFSBucket(db, { bucketName: 'thumbs' });
    const thumb = await bucket.find({ 'metadata.photoid': id }).toArray();

    //const photo = await collection.find({_id: ObjectId(id)}).toArray()
    return thumb[0]
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

async function findDuplicatePhoto(bid, uid) {
    const db = getDbInstance()
    const collection = db.collection('photos')
    const review = await collection.find({businessid: ObjectId(bid), userid: uid}).toArray()
    //console.log("review", review.matchedCount)
    return review.length >= 1
}

/*
 * Route to create a new photo.
 */
router.post('/', requireAuthentication, upload.single('photo'), async function (req, res, next) {
  const uid = req.body.userid
  const bid = req.body.businessid
  //if (validateAgainstSchema(req.body, photoSchema)) {
  if (req.file && req.body && uid && bid) {
    //const photo = extractValidFields(req.body, photoSchema);

    if (ObjectId.isValid(uid) && ObjectId.isValid(bid)) {
      if (req.user !== uid && !req.admin ) {
        res.status(403).json({
          error: "Unauthorized to access the specified resource"
        });
      } else {
        const photo = {
          contentType: req.file.mimetype,
          filename: req.file.filename,
          path: req.file.path,
          userid: uid,
          businessid: bid
        };
        if (req.body.caption) {
          photo.caption = req.body.caption
        }
        var id = null
        try {
          id = await saveImageFile(photo)
          producePhoto(id.toString())
        } catch (err) {
          next(err)
        }
        //const id = await insertNewPhoto(photo)
        if (id) {
          console.log("req.file", req.file)
          //await removeUploadedFile(req.file);
          res.status(201).json({
            id: id,
            links: {
              photo: `/photos/${id}`,
              business: `/businesses/${bid}`
            }
          });
        } else {
          res.status(400).json({
            error: "Business does not exist"
          });
        }
      }
    } else {
      res.status(400).json({
        error: "Invalid user id or business id given"
      })
    }
  } else {
    res.status(400).json({
      error: "Request body does not contain required fields"
    })
  }
  // } else {
  //   res.status(400).json({
  //     error: "Request body is not a valid photo object"
  //   });
  // }
});




/*
 * Route to fetch info about a specific photo.
 */
router.get('/:photoID', requireAuthentication, async function (req, res, next) {
  const photoID = req.params.photoID
  var photo = null
  var thumb = null

  try {
    photo = await getPhotoById(photoID)
    thumb = await getThumbById(photoID)

  } catch (err) {
    next(err)
  }

  if (photo) {
    //delete photo.path
    const responseBody = {
      _id: photo._id,
      url: `/media/photos/${photo.filename}`,
      contentType: photo.metadata.contentType,
      caption: photo.metadata.caption,
      userid: photo.metadata.userid,
      businessid: photo.metadata.businessid,
      thumbId: thumb._id,
      thumbnail_url: `/media/thumbs/${thumb.filename}`
    };
    res.status(200).send(responseBody);
    //photo.url = `/media/photos/${photo.filename}`
    //res.status(200).json(photo);
  } else {
    next();
  }
});

/*
 * Route to update a photo.
 */
router.patch('/:photoID', requireAuthentication, async function (req, res, next) {
  const photoID = req.params.photoID

  if (ObjectId.isValid(photoID)) {
    if (validateAgainstSchema(req.body, photoSchema)) {
      const oldPhoto = await getPhotoById(photoID)
      if (oldPhoto) {
        if (req.user !== oldPhoto.userid && !req.admin ) {
          res.status(403).json({
            error: "Unauthorized to access the specified resource"
          });
        } else {
          /*
           * Make sure the updated photo has the same businessid and userid as
           * the existing photo.
           */

          const updatedPhoto = extractValidFields(req.body, photoSchema);

          if (oldPhoto.userid == updatedPhoto.userid && oldPhoto.businessid.equals(ObjectId(updatedPhoto.businessid))) {
            const conf = modifyPhoto(photoID, updatedPhoto)
            res.status(200).json({
              links: {
                photo: `/photos/${photoID}`,
                business: `/businesses/${updatedPhoto.businessid}`
              }
            });
          } else {
            res.status(403).json({
              error: "Updated photo cannot modify businessid or userid"
            });
          }
        }
      } else {
        next()
      }
    } else {
        res.status(400).json({
          error: "Request body is not a valid photo object"
        });
    }
  } else {
    next()
  }

});

/*
 * Route to delete a photo.
 */
router.delete('/:photoID', requireAuthentication, async function (req, res, next) {
  const photoID = req.params.photoID
  //const delSuccess = await removePhoto(photoID)

  if (ObjectId.isValid(photoID)) {
    const photo = await getPhotoById(photoID)
    //console.log("business", business)
    if (photo) {
      if (req.user !== photo.userid && !req.admin) {
        res.status(403).json({
          error: "Unauthorized to access the specified resource"
        });
      } else {
        const delSuccess = await removePhoto(photoID)
        if (delSuccess) {
          res.status(204).end()
        } else {
          next();
        }
      }
    } else {
      next()
    }
  } else {
    next()
  }
});
