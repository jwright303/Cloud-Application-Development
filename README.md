# Cloud-Application-Development
This class was focused on developing a restful API for a yelp-like application. The API I created connects to a mongoDB database running inside a Docker container. The database was used to keep track of individual businesses, reviews, photos, and users. I created multiple different endpoints which handeled things such as getting information about the buisniesses, modifying user reviews, and uploading and storing images on the backend. All of the endpoints written can be found at `/Assignment-4/api/` and `/Final-Assignment/api/` rsepectively.

The two assignments that are included is assignment 4 and the final project. Assignment 4 contains the culmination of the yelp-like API with features such as user authentication, and offline image processing and storing. The Final-Project contains a lot of the same functionality, but for a canvas-like application and also includes rate-limiting.

## Assignment 4

### Features
Some of the features that are included in the yelp like applicaiton are:
  * Pagination for getting the list of all businesses
  * MongoDB database for storing the information
  * Authentication for certain actions such as editing information and deleting entries
  * Offline work using rabbitmq pipelines to create thumbnails for the images that are uploaded through the API
  * API, Database, and RabbitMQ all running in docker containers

## Final Project

### Features
Some of the features that are included in the yelp like applicaiton are:
  * Pagination for getting the list of all businesses
  * SQL database for storing the information
  * Authentication for certain actions such as editing information and deleting entries
  * Token bucket based rate limiting for users depending on their credntials
  * API and Database running in docker containers

## How to run
### Required software
Before running the code, there are a few important installations that are needed.
 - `node.js` and `npm` must be installed information can be found [here](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm#osx-or-linux-node-version-managers)
 - `Docker` must also be installed in order to set up the database that are used. Instructions for installation can be found [here](https://docs.docker.com/get-docker/)

### Setting up the API
Once npm and node js are installed you can download some other packages that are needed by the programs. This can be done by running `npm install` which will install some of the packages enumerated in `package.json`. 

Connecting the API to the database requires that a few of the enviornment variables are set such as the host, user, and password. A list of these can be found in `commands.txt`. 

Docker containers for the client and the server must be created as well with certain parameters to set envionrment variables and expose a port. The commands for these can also be found in `commands.txt`

Once these containers are created the last thing we have to do is start our API which can be done by running `npm start` at the base directory of each project
