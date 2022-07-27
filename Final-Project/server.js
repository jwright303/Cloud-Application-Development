const express = require('express')
const morgan = require('morgan')
const redis = require('redis')

const sequelize = require('./lib/sequelize')
const { getAuthenticatedUser } = require('./lib/auth')
const api = require('./api')

const app = express()
const port = process.env.PORT || 8000

const redisHost = process.env.REDIS_HOST || 'localhost';
const redisPort = process.env.REDIS_PORT || 6379;

// const redisClient = redis.createClient({
//   url: `redis://${redisHost}:${redisPort}`
// });

const redisClient = redis.createClient(redisHost, redisPort)
let rateLimitMaxReq = 10
const rateLimitWindowMs = 60000

async function rateLimit(req, res, next) {
  let usr = getAuthenticatedUser(req, res, next)
  if (usr) {
    rateLimitMaxReq = 30
    usr = String(usr)
  } else {
    rateLimitMaxReq = 10
  }
  console.log("==user:", usr)
  const ip = req.ip
  const rateKey = usr || ip
  //const tokenBucket = await getUserTokenBucket(ip)

  let tokenBucket = await redisClient.hGetAll(rateKey)
  //console.log("==tokenBucket:", tokenBucket)

  if (tokenBucket) {
    tokenBucket.tokens = parseFloat(tokenBucket.tokens) || rateLimitMaxReq
  } else {
    tokenBucket = {
      tokens: rateLimitMaxReq,
      last: Date.now()
    }
  }
  console.log("==tokenBucket:", tokenBucket)
  // if (!!tokenBucket.tokens == false) {
  //   tokenBucket.tokens = rateLimitMaxReq
  // } 

  const now = Date.now()
  const ellapsed = now - tokenBucket.last
  tokenBucket.tokens += ellapsed * (rateLimitMaxReq / rateLimitWindowMs)
  tokenBucket.tokens = Math.min(rateLimitMaxReq, tokenBucket.tokens)
  tokenBucket.last = now

  if (!!tokenBucket.tokens == false) {
    tokenBucket.tokens = rateLimitMaxReq
  }
  //console.log("==tokenBucket:", tokenBucket)


  if (tokenBucket.tokens >= 1) {
    tokenBucket.tokens -= 1
    //save the token bucket back
    await redisClient.hSet(rateKey, 'tokens', tokenBucket.tokens)
    await redisClient.hSet(rateKey, 'last', tokenBucket.last)

    next()
  } else {
    //save the token bucket back
    await redisClient.hSet(rateKey, 'tokens', tokenBucket.tokens)
    await redisClient.hSet(rateKey, 'last', tokenBucket.last)
    res.status(429).send({err: "Too many requests per minute"})
  }
}

/*
 * Morgan is a popular logger.
 */
//app.use(rateLimit)
app.use(morgan('dev'))

app.use(express.json())
app.use(express.static('public'))
app.use(rateLimit)

/*
 * All routes for the API are written in modules in the api/ directory.  The
 * top-level router lives in api/index.js.  That's what we include here, and
 * it provides all of the routes.
 */
app.use('/', api)

app.use('*', function (req, res, next) {
  res.status(404).json({
    error: "Requested resource " + req.originalUrl + " does not exist"
  })
})

/*
 * This route will catch any errors thrown from our API endpoints and return
 * a response with a 500 status to the client.
 */
app.use('*', function (err, req, res, next) {
  console.error("== Error:", err)
  res.status(500).send({
      error: "Server error.  Please try again later."
  })
})

sequelize.sync().then(function () {
  redisClient.connect()
  app.listen(port, function () {
      console.log("== Server is listening on port:", port)
  })
})
