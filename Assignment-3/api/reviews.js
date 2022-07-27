const router = require('express').Router();
const { ObjectId } = require('mongodb')

const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const { getDbInstance } = require('../lib/mongo');
const { requireAuthentication } = require('../lib/auth');
//const { getBusinessById } = require('./businesses')

const reviews = require('../data/reviews');

exports.router = router;
exports.reviews = reviews;

/*
 * Schema describing required/optional fields of a review object.
 */
const reviewSchema = {
  userid: { required: true },
  businessid: { required: true },
  dollars: { required: true },
  stars: { required: true },
  review: { required: false }
};

/*
 * See businesses.js file for more detailed documentation on most of these functions
 */
async function removeReview(id) {
  const db = getDbInstance()
  const collection = db.collection('reviews')
  const conf = await collection.deleteOne({_id: new ObjectId(id)})
  return conf.deletedCount > 0
}

async function insertNewReview(review) {
    const db = getDbInstance()
    review.businessid = ObjectId(review.businessid)
    var collection = db.collection('businesses')
    const existingB = await collection.find({_id: new ObjectId(review.businessid)})
    if (!existingB) {
      return null
    }

    collection = db.collection('reviews')

    review = extractValidFields(review, reviewSchema)
    const result = await collection.insertOne(review)
    return result.insertedId
}

async function modifyReview(id, review) {
    const db = getDbInstance()
    const collection = db.collection('reviews')
    review.businessid = ObjectId(review.businessid)

    const result = await collection.replaceOne(
      { _id: new ObjectId(id) },
      review
    )
    return result.matchedCount > 0
}

async function getReviewById(id) {
    const db = getDbInstance()
    const collection = db.collection('reviews')
    const review = await collection.find({_id: ObjectId(id)}).toArray()
    return review[0]
}

// Function for finding duplicate reviews, checks to see if there are reviews that already exist for a given user and business id
async function findDuplicateReview(bid, uid) {
    const db = getDbInstance()
    const collection = db.collection('reviews')
    const review = await collection.find({businessid: ObjectId(bid), userid: uid}).toArray()
    
    //This will return true if there is a business already
    return review.length >= 1
}

/*
 * Route to create a new review.
 */
router.post('/', requireAuthentication, async function (req, res, next) {
  if (validateAgainstSchema(req.body, reviewSchema)) {
    const review = extractValidFields(req.body, reviewSchema);

    /*
     * Make sure the user is not trying to review the same business twice.
     */
    if (ObjectId.isValid(review.userid)) {
      if (req.user !== review.userid && !req.admin ) {
        res.status(403).json({
          error: "Unauthorized to access the specified resource"
        });
      } else {
        const isDup = await findDuplicateReview(review.businessid, review.userid)
        console.log("user passed val")

        if (isDup) {
          res.status(403).json({
            error: "User has already posted a review of this business"
          });
        } else {
          console.log("no dup")
          if (review.stars >= 0 && review.stars <= 5 && review.dollars.length < 5 && review.dollars.length > 0) {
            const id = await insertNewReview(review)
            console.log("inserted", id)
            if (id) {
              res.status(201).json({
                id: id,
                links: { review: `/reviews/${id}`, business: `/businesses/${review.businessid}` }
              });
            } else {
              next()
            }
          } else {
            res.status(403).json({
              error: "Invalid values in review"
            });
          }
        }
      }
    } else {
      next()
    }

  } else {
    res.status(400).json({
      error: "Request body is not a valid review object"
    });
  }
});

/*
 * Route to fetch info about a specific review.
 */
router.get('/:reviewID', requireAuthentication, async function (req, res, next) {
  const reviewID = req.params.reviewID
  if (reviewID.length == 24) {
    var rev = await getReviewById(reviewID)
    if (rev.length != 0) {
      res.status(200).json(rev);
    } else {
      next();
    }
  } else {
    next();
  }
});

/*
 * Route to update a review.
 */
router.patch('/:reviewID', requireAuthentication, async function (req, res, next) {
  const reviewID = req.params.reviewID

  if (validateAgainstSchema(req.body, reviewSchema)) {
    // First must make sure that the old review we are modifying exists
    if (ObjectId.isValid(reviewID)) {
      const oldRev = await getReviewById(reviewID)
      if (oldRev) {
        if (req.user !== oldRev.userid && !req.admin ) {
          res.status(403).json({
            error: "Unauthorized to access the specified resource"
          });
        } else {
          /*
           * Make sure the updated review has the same businessid and userid as
           * the existing review.
           */
          let updatedReview = extractValidFields(req.body, reviewSchema);
          
          //Since we already got the old review we can make sure that bid and uid match 
          if (oldRev.userid == updatedReview.userid && oldRev.businessid.equals(ObjectId(updatedReview.businessid))) {
            const conf = modifyReview(reviewID, updatedReview)
            res.status(200).json({
              links: {
                review: `/reviews/${reviewID}`,
                business: `/businesses/${updatedReview.businessid}`
              }
            });
          } else {
            res.status(403).json({
              error: "Updated review cannot modify businessid or userid"
            });
          }
        }
      } else {
        next()
      }
    } else {
      next()
    }
  } else {
      res.status(400).json({
        error: "Request body is not a valid review object"
      });
  }
});

/*
 * Route to delete a review.
 */
router.delete('/:reviewID', requireAuthentication, async function (req, res, next) {
  const reviewID = req.params.reviewID

  if (ObjectId.isValid(reviewID)) {
    const review = await getReviewById(reviewID)
    //console.log("business", business)
    if (review) {
      if (req.user !== review.userid && !req.admin) {
        res.status(403).json({
          error: "Unauthorized to access the specified resource"
        });
      } else {
        delSuccess = await removeReview(reviewID)
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
