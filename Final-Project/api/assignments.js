const { Router } = require('express')
const { ValidationError } = require('sequelize')

const { Assignment, AssignmentClientFields, getAssignmentById } = require('../models/assignment')
const { Submission, SubmissionClientField, insertNewSubmission } = require('../models/submission')
const { generateAuthToken, requireAuthentication } = require('../lib/auth')
const { UserSchema, getUserById } = require('../models/user')
const { Course, getCourseById } = require('../models/course')

const router = Router()

router.get('/', async function (req, res) {
  let page = parseInt(req.query.page) || 1
  page = page < 1 ? 1 : page
  const numPerPage = 10
  const offset = (page - 1) * numPerPage

  const result = await Assignment.findAndCountAll({
    limit: numPerPage,
    offset: offset
  })

  const lastPage = Math.ceil(result.count / numPerPage)
  const links = {}
  if (page < lastPage) {
    links.nextPage = `/assignments?page=${page + 1}`
    links.lastPage = `/assignments?page=${lastPage}`
  }
  if (page > 1) {
    links.prevPage = `/assignments?page=${page - 1}`
    links.firstPage = '/assignments?page=1'
  }

  res.status(200).json({
    assignments: result.rows,
    pageNumber: page,
    totalPages: lastPage,
    pageSize: numPerPage,
    totalCount: result.count,
    links: links
  })
})

router.post('/', requireAuthentication, async function (req, res, next) {
  try {
    const assignment = await Assignment.create(req.body, AssignmentClientFields)
    res.status(201).send({ id: assignment.id })
  } catch (e) {
    if (e instanceof ValidationError) {
      res.status(400).send({ error: e.message })
    } else {
      throw e
    }
  }
})

router.get('/:assignmentId', requireAuthentication, async function (req, res, next) {
  const assignmentId = req.params.assignmentId
    const assignment = await Assignment.findByPk(assignmentId, {
      //include: [ Submission ]
    })
    if (assignment) {
      res.status(200).send(assignment)
    } else {
      next()
    }

})

router.delete('/:assignmentId', requireAuthentication, async function (req, res, next) {
  const assignmentId = req.params.assignmentId
  const result = await Assignment.destroy({ where: { id: assignmentId }})
  if (result > 0) {
    res.status(204).send()
  } else {
    next()
  }
})

router.patch('/:assignmentId', requireAuthentication, async function (req, res, next) {
  const assignmentId = req.params.assignmentId
  const result = await Assignment.update(req.body, {
    where: { id: assignmentId },
    fields: AssignmentClientFields
  })
  if (result[0] > 0) {
    res.status(204).send()
  } else {
    next()
  }
})

/*
* Create Submission
*/
router.post('/:id/submissions', requireAuthentication, async function (req,res,next){
  const getUser = await getUserById(req.user)
  const getAssignment = await(getAssignmentById(req.params.id))
  const result = await Course.findOne({
    where: { id: getAssignment.courseId},
    include: UserSchema 
   })
   const enrolled = result.users
   enrolled.filter(enrolled => enrolled.user === getUser)

   let authenticated = false
   for(let i = 0; i < enrolled.length; i++){
     if(enrolled[i].dataValues.id === getUser.id){
      authenticated = true
     }
      
   }
  if(authenticated == false)
    res.status(403).send({error: "Only an authenticated student who is enrolled in this course can post a submission"})
  else{
    try {
      const submission = await Submission.create(req.body, SubmissionClientField)
      res.status(201).send({ id: submission.id })
    } catch (e) {
      if (e instanceof ValidationError) {
        res.status(400).send({ error: e.message })
      } else {
        throw e
      }
    }
  }
})


/*
* Fetch all Submissions for an assignment
*/
router.get('/:id/submissions', requireAuthentication, async function (req, res, next) {
    /*
    * Compute page number based on optional query string parameter `page`.
    * Make sure page is within allowed bounds.
    */
    const getUser = await getUserById(req.user)
    console.log("===USER", getUser)
    if(getUser.role == "instructor" || getUser.role == "admin"){
    let page = parseInt(req.query.page) || 1
    page = page < 1 ? 1 : page
    const numPerPage = 10
    const offset = (page - 1) * numPerPage

    const result = await Submission.findAndCountAll({
      where: {assignmentId: req.params.id},
      limit: numPerPage,
      offset: offset
    })

    /*
    * Generate HATEOAS links for surrounding pages.
    */
    const lastPage = Math.ceil(result.count / numPerPage)
    const links = {}
    if (page < lastPage) {
      links.nextPage = `/businesses?page=${page + 1}`
      links.lastPage = `/businesses?page=${lastPage}`
    }
    if (page > 1) {
      links.prevPage = `/businesses?page=${page - 1}`
      links.firstPage = '/businesses?page=1'
    }

    /*
    * Construct and send response.
    */
    res.status(200).json({
      submission: result.rows,
      pageNumber: page,
      totalPages: lastPage,
      pageSize: numPerPage,
      totalCount: result.count,
      links: links
    })
  }
  else{
    res.status(403).send({error: "Only a user with the admin or instructor role can access thhis information"})
  }
})

module.exports = router
