const router = require('express').Router();
const jwt = require('jsonwebtoken')

const secretKey = 'MajorKey'

function generateAuthToken(userID, admin) {
	const payload = { sub: userID, admin: admin }
	return jwt.sign(payload, secretKey, { expiresIn: '24h' })
}
exports.generateAuthToken = generateAuthToken;

function requireAuthentication(req, res, next) {
	const authHeader = req.get('Authorization') || '';
	const authHeaderParts = authHeader.split(' ');

	const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null;
	//console.log("token", token)
	try {
	  const payload = jwt.verify(token, secretKey);
	  //console.log("req", req)
	  req.user = payload.sub;
	  req.admin = payload.admin
	  //console.log("req", req.user)
	  next()
	} catch (err) {
		//console.log("invalid JWT")
		res.status(401).json({
		  error: "Invalid authentication token provided."
		});

	}

}
exports.requireAuthentication = requireAuthentication;

function getAdminFromToken(req, res, next) {
	const authHeader = req.get('Authorization') || '';
	const authHeaderParts = authHeader.split(' ');

	const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null;
	//console.log("token", token)
	try {
	  const payload = jwt.verify(token, secretKey);
	  //console.log("req", req)
	  req.isAdmin = payload.admin
	} catch (err) {
		req.isAdmin = false
	}
	next()
}
exports.getAdminFromToken = getAdminFromToken
