const router = require('express').Router();
const { ObjectId } = require('mongodb')

const { validateAgainstSchema, extractValidFields } = require('../lib/validation');
const { generateAuthToken, requireAuthentication } = require('../lib/auth');

const { getDbInstance } = require('../lib/mongo');

const businesses = require('../data/businesses');
const { reviews } = require('./reviews');
const { photos } = require('./photos');

exports.router = router;
exports.businesses = businesses;

/*
 * Schema describing required/optional fields of a business object.
 */
const businessSchema = {
  ownerid: { required: true },
  name: { required: true },
  address: { required: true },
  city: { required: true },
  state: { required: true },
  zip: { required: true },
  phone: { required: true },
  category: { required: true },
  subcategory: { required: true },
  website: { required: false },
  email: { required: false }
};

/*
 * Below are the async functions used to communicate from our API to the database in the docker container
 * These are all based on the functions shown in class, however they are now moved into the same file as the endpoints
 * The Functions are for viewing all businesses, removing a business, inserting a business, modifying a business, and viewing a single business
 */

// Function for getting all the businesses from the database
// Waits for the database to respond using the await command, then converts it to an array
async function getAllBusinesses() {
  const db = getDbInstance()
  const collection = db.collection('businesses')
  const businesses = await collection.find({}).toArray()
  return businesses
}

// Function for removing a business based on its id
// The return is based on if there was any business that matches the id, false if it doesnt exist
async function removeBusiness(id) {
  const db = getDbInstance()
  const collection = db.collection('businesses')
  const conf = await collection.deleteOne({_id: new ObjectId(id)})
  return conf.deletedCount > 0
}

// Function for inserting a new business, based on the supplied json business object
// Returns the id of the newly added business
async function insertNewBusiness(business) {
  const db = getDbInstance()
  const collection = db.collection('businesses')

  business = extractValidFields(business, businessSchema)
  const result = await collection.insertOne(business)
  return result.insertedId
}

// Function for modifying a business, needs the id of the old business and the new business json body
// The return is baed on if there was any business that matched the id, false if the business to modify doesnt exist
async function modifyBusiness(id, business) {
  //business = extractValidFields(business, businessSchema)

  const db = getDbInstance()
  const collection = db.collection('businesses')

  const result = await collection.replaceOne(
    { _id: new ObjectId(id) },
    business
  );
  return result.matchedCount > 0;
}

// Function for returning information on a business including its corresponding reviews and photos
// Returns the aggregation of the business, its reviews and photos
async function getBusinessById(id) {
  const db = getDbInstance()
  const collection = db.collection('businesses')

  // Aggregate function is used to combine a few functions, first searches our collection for a business matching the id
  //    Next uses lookup to find elements in reviews whose businessid matches the _id of the business
  //    Finally uses lookup again to find elements in photos whose businessid matches the _id of the business
  const business = await collection.aggregate([
      { $match: { _id: new ObjectId(id) } },
      { $lookup: {
          from: "reviews",
          localField: "_id",
          foreignField: "businessid",
          as: "reviews"
        }
      },
      { $lookup: {
          from: "photos",
          localField: "_id",
          foreignField: "businessid",
          as: "photos"
        }
      }
  ]).toArray()
  // If successful then it will be an array of 1 element so return the first
  return business[0]
}
/*
 * Route to return a list of businesses.
 *
 * This endpoint is largely unchanged, main difference is getting the businesses from the database
 */
router.get('/', async function (req, res) {
  const businesses = await getAllBusinesses()
  //console.log("Hello world")

  /*
   * Compute page number based on optional query string parameter `page`.
   * Make sure page is within allowed bounds.
   */
  let page = parseInt(req.query.page) || 1;
  const numPerPage = 5;
  const lastPage = Math.ceil(businesses.length / numPerPage);
  page = page > lastPage ? lastPage : page;
  page = page < 1 ? 1 : page;

  /*
   * Calculate starting and ending indices of businesses on requested page and
   * slice out the corresponsing sub-array of busibesses.
   */
  const start = (page - 1) * numPerPage;
  const end = start + numPerPage;
  const pageBusinesses = businesses.slice(start, end);

  /*
   * Generate HATEOAS links for surrounding pages.
   */
  const links = {};
  if (page < lastPage) {
    links.nextPage = `/businesses?page=${page + 1}`;
    links.lastPage = `/businesses?page=${lastPage}`;
  }
  if (page > 1) {
    links.prevPage = `/businesses?page=${page - 1}`;
    links.firstPage = '/businesses?page=1';
  }

  /*
   * Construct and send response.
   */
  res.status(200).json({
    businesses: pageBusinesses,
    pageNumber: page,
    totalPages: lastPage,
    pageSize: numPerPage,
    totalCount: businesses.length,
    links: links
  });

});

/*
 * Route to create a new business.
 * 
 * Again this function is hardly changes, just insert new business to database, and store its id
 */
router.post('/', requireAuthentication, async function (req, res, next) {
  if (validateAgainstSchema(req.body, businessSchema) && ObjectId.isValid(req.body.ownerid) ) {
    const business = extractValidFields(req.body, businessSchema);
    //console.log(ObjectId.isValid(business.ownerid))
      if (req.user !== business.ownerid && !req.admin ) {
        res.status(403).json({
          error: "Unauthorized to access the specified resource"
        });
      } else {
        const id = await insertNewBusiness(business)
        res.status(201).json({
          id: id,
          links: {
            business: `/businesses/${id}`
          }
        });
      }
  } else {
    res.status(400).json({
      error: "Request body is not a valid business object"
    });
  }
});

/*
 * Route to fetch info about a specific business.
 * 
 * This route is simplified, as most of the functionality is moved to the async function which aggreates everything for us
 * If the business/information exists then return it to the user otherwise return an error
 */
router.get('/:businessid', async function (req, res, next) {
  const businessid = req.params.businessid
  if (ObjectId.isValid(businessid)) {
    const business = await getBusinessById(businessid)
    if (business) {
      
      res.status(200).json(business);
    } else {
      next();
    }
  }
});

/*
 * Route to replace data for a business.
 * 
 * Uses modify business async function to update the information, if it exists then it sends back a 204 response
 */
router.patch('/:businessid', requireAuthentication, async function (req, res, next) {
  const businessid = req.params.businessid
  const bIsOID = ObjectId.isValid(businessid)
  const oIsOID = ObjectId.isValid(req.body.ownerid)

  if (validateAgainstSchema(req.body, businessSchema) && bIsOID && oIsOID) {
    var business = extractValidFields(req.body, businessSchema)

    if (req.user !== business.ownerid && !req.admin ) {
      res.status(403).json({
        error: "Unauthorized to access the specified resource"
      });
    } else {
      const updateSuccess = await modifyBusiness(businessid, business);
      if (updateSuccess) {
        res.status(204).send()
      } else {
        next()
      }
    }
  } else {
    next()
  }
});

/*
 * Route to delete a business.
 */
router.delete('/:businessid', requireAuthentication, async function (req, res, next) {
  const businessid = req.params.businessid
  var business = null

  if (ObjectId.isValid(businessid) && (business = await getBusinessById(businessid))) {
    //const business = await getBusinessById(businessid)
    if (req.user !== business.ownerid && !req.admin) {
      res.status(403).json({
        error: "Unauthorized to access the specified resource"
      });
    } else {
      delSuccess = await removeBusiness(businessid)
      if (delSuccess) {
        res.status(204).end()
      } else {
        next();
      }
    }
  } else {
    next()
  }
});
