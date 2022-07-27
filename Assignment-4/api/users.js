const router = require('express').Router();
const { ObjectId } = require('mongodb')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { generateAuthToken, requireAuthentication, getAdminFromToken } = require('../lib/auth');

const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const { getDbInstance } = require('../lib/mongo');

exports.router = router;
//const secretKey = 'MajorKey'

const { businesses } = require('./businesses');
const { reviews } = require('./reviews');
const { photos } = require('./photos');

const userSchema = {
  name: { required: true },
  email: { required: true },
  password: { required: true },
  admin: { required: false }
};


async function getUReviews(id) {
  const db = getDbInstance()
  const collection = db.collection('reviews')
  const reviews = await collection.find({userid: id}).toArray()
  return reviews
}

async function getUBusinesses(id) {
  const db = getDbInstance()
  const collection = db.collection('businesses')
  const userB = await collection.find({ownerid: id}).toArray()
  return userB
}

async function getUPhotos(id) {
  const db = getDbInstance()
  const collection = db.collection('photos')
  const photos = await collection.find({userid: id}).toArray()
  return photos
}

async function insertNewUser(user) {
  const db = getDbInstance()
  const collection = db.collection('users')

  const passwordHash = await bcrypt.hash(user.password, 8)
  user.password = passwordHash

  const result = await collection.insertOne(user)
  return result.insertedId
}

async function getUserById(id, includePassword) {
  const db = getDbInstance()
  const collection = db.collection('users')

  const projection = includePassword ? {} : { password: 0 }
  const user = await collection.find({_id: new ObjectId(id)}).project(projection).toArray()

  return user[0]
}

async function getUserByEmail(email) {
  const db = getDbInstance()
  const collection = db.collection('users')

  const user = await collection.find({email: email}).toArray()
  return user[0]
}

async function validateUser(id, password) {
  const db = getDbInstance()
  const collection = db.collection('users')

  const existingUser = await getUserByEmail(id)

  const authenticated = existingUser && await bcrypt.compare(password, existingUser.password);
  return authenticated
}

// function generateAuthToken(userID) {
//  const payload = { sub: userID }
//  return jwt.sign(payload, secretKey, { expiresIn: '24h' })
// }
// //exports.generateAuthToken = generateAuthToken;

// function requireAuthentication(req, res, next) {

// }
// exports.requireAuthentication = requireAuthentication;
//exports.generateAuthToken = generateAuthToken;


/*
 * Route to list all of a user's businesses.
 */
router.get('/:userid/businesses', requireAuthentication, async function (req, res, next) {
  const userid = req.params.userid

  if (ObjectId.isValid(userid)) {
    if (req.user !== userid && !req.admin) {
        res.status(403).json({
          error: "Unauthorized to access the specified resource"
        });
    } else {
      const userBusinesses = await getUBusinesses(userid)
      if (userBusinesses.length != 0) {
        res.status(200).json({
          businesses: userBusinesses
        });
      } else {
        next()
      }
    }
  } else {
    next()
  }
});

/*
 * Route to list all of a user's reviews.
 */
router.get('/:userid/reviews', requireAuthentication, async function (req, res, next) {
  const userid = req.params.userid

  if (ObjectId.isValid(userid)) {
    if (req.user !== userid && !req.admin) {
        res.status(403).json({
          error: "Unauthorized to access the specified resource"
        });
    } else {
      const userReviews = await getUReviews(userid)
      if (userReviews.length != 0) {
        res.status(200).json({
          reviews: userReviews
        });
      } else {
        next()
      }
    }
  } else {
    next()
  }
});

/*
 * Route to list all of a user's photos.
 */
router.get('/:userid/photos', requireAuthentication, async function (req, res, next) {
  const userid = req.params.userid

  if (ObjectId.isValid(userid)) {
    if (req.user !== userid && !req.admin) {
        res.status(403).json({
          error: "Unauthorized to access the specified resource"
        });
    } else {
      //console.log("pass auth")
      const userPhotos = await getUPhotos(userid)
      if (userPhotos.length != 0) {
        res.status(200).json({
          photos: userPhotos
        });
      } else {
        next()
      }
    }
  } else {
    next()
  }
});

/*
 * Endpoint for creating a new user
 */
router.post('/', getAdminFromToken, async function (req, res, next) {
  if (validateAgainstSchema(req.body, userSchema)) {
    const user = extractValidFields(req.body, userSchema);
    user.admin = user.admin || false

    if (user.admin == req.isAdmin || req.isAdmin) {
      const existingUser = await getUserByEmail(user.email)
      if (!existingUser) {
        const id = await insertNewUser(user)
        res.status(201).json({
          id: id,
          links: {
            user: `/users/${id}`
          }
        });
      } else {
        res.status(400).json({
          error: "User already exists"
        })
      }
    } else {
     res.status(400).json({
       error: "Only admins can create admin users"
     });
    }
  } else {
    res.status(400).json({
      error: "Request body is not a valid user object"
    });
  }
});

router.get('/:userid', requireAuthentication, async function (req, res, next) {
  const userid = req.params.userid

  // console.log("userid", userid)
  // console.log("user", req.user)
  if ((typeof userid == "string") && userid.length == 24) {
    const user = await getUserById(userid)
    //console.log("user", user)
    if (req.user !== userid && !req.admin) {
      res.status(403).json({
        error: "Unauthorized to access the specified resource"
      });

    } else {
      if (user) {
        res.status(200).json({
          user: user
        });
      } else {
        next()
      }
    }
  } else {
    next()
  }
});

router.post('/login', async function (req, res, next) {
  if (req.body.email && req.body.password) {
    const user = extractValidFields(req.body, userSchema)
    //console.log("user", user)
      try {
        //console.log("email, password", user.email, user.email)
        const authenticated = await validateUser(user.email, user.password);
        //console.log("aten", authenticated == true)

        if (authenticated == true) {
          //console.log("before 500")
          const existingUser = await getUserByEmail(user.email)
          const id = existingUser._id.toString()
          //console.log("id", id)
          //console.log("email, password", existingUser.email, existingUser.password)

          //console.log("id " + id)
          const token = generateAuthToken(id, existingUser.admin);
          res.status(200).send({token: token});
        } else {
          res.status(401).send({
            error: "Invalid authentication credentials"
          });
        }
      } catch (err) {
        res.status(500).send({
          error: "Error logging in.  Try again later."
        });
      }
  } else {
    next()
  }
})
