const express = require('express');
const morgan = require('morgan');
const multer = require('multer');

const api = require('./api');
const { ObjectId, GridFSBucket } = require('mongodb')
const { connectToDb, getDbInstance } = require('./lib/mongo')
//const { getPhotoDownloadStreamByFilename} = require('./models/photo');


const app = express();
const port = process.env.PORT || 8000;

/*
 * Morgan is a popular logger.
 */

function getPhotoDownloadStreamByFilename(filename) {
  console.log("filename: ", filename)
  const db = getDbInstance();
  const bucket = new GridFSBucket(db, { bucketName: 'photos' });
  //console.log(bucket.find({filename: filename}))
  photo = bucket.openDownloadStreamByName(filename);
  //console.log(res)

  return photo
}

function getThumbnailDownloadStreamByFilename(filename) {
  console.log("filename: ", filename)
  const db = getDbInstance();
  const bucket = new GridFSBucket(db, { bucketName: 'thumbs' });
  //console.log(bucket.find({filename: filename}))
  thumb = bucket.openDownloadStreamByName(filename);
  //console.log(res)

  return thumb
}


app.use(morgan('dev'));

app.use(express.json());
app.use(express.static('public'));

/*
 * All routes for the API are written in modules in the api/ directory.  The
 * top-level router lives in api/index.js.  That's what we include here, and
 * it provides all of the routes.
 */
app.use('/', api);

//app.get('/media/photos')
//app.use('/media/photos', express.static(`${__dirname}/uploads`));
app.get('/media/photos/:filename', (req, res, next) => {
  getPhotoDownloadStreamByFilename(req.params.filename)
    .on('file', function (file) {
      console.log("file", file)
      res.status(200).type(file.metadata.contentType)
      console.log("sent")
    })
    .on('error', function (err) {
      if (err.code === 'ENOENT') {
        next()
      } else {
        next(err)
      }
    })
    .pipe(res)
});


app.get('/media/thumbs/:filename', (req, res, next) => {
  getThumbnailDownloadStreamByFilename(req.params.filename)
    .on('file', function (file) {
      console.log("file", file)
      res.status(200).type(file.metadata.contentType)
      console.log("sent")
    })
    .on('error', function (err) {
      if (err.code === 'ENOENT') {
        next()
      } else {
        next(err)
      }
    })
    .pipe(res)
});


app.use('*', function (req, res, next) {
  res.status(404).json({
    error: "Requested resource " + req.originalUrl + " does not exist"
  });
});

/*
 * This route will catch any errors thrown from our API endpoints and return
 * a response with a 500 status to the client.
 */
app.use('*', function (err, req, res, next) {
  console.error("== Error:", err)
  res.status(500).send({
      err: "Server error.  Please try again later."
  })
})

connectToDb(function () {
  app.listen(port, function() {
    console.log("== Server is running on port", port);
  })
})

