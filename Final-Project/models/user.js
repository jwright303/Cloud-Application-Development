const { DataTypes } = require('sequelize')
const sequelize = require('../lib/sequelize')

const bcrypt = require('bcryptjs')
const { extractValidFields } = require('../lib/validation')


const UserSchema = sequelize.define('user', {
  name: { type: DataTypes.STRING, allowNull: false},
  email: { type: DataTypes.STRING, allowNull: false, unique: true},
  password: { type: DataTypes.STRING, allowNull: true },
  role: {type: DataTypes.STRING, allowNull: false, defaultValue: "student"}
})

exports.UserSchema = UserSchema
exports.UserClientFields = [
  'name',
  'email',
  'password',
  'role',
  'courseId'
]

exports.insertNewUser = async function (user) {
  user.password = await bcrypt.hash(user.password, 8)
  console.log("== Hashed, salted password:", user.password)
  const result = await UserSchema.create(user, exports.UserClientFields)
  return result.id
}


/*
* Fetch a user from the DB based on user ID.
*/
exports.getUserById = async function (id, includePassword) {
  const user = await UserSchema.findByPk(id)
  if(!includePassword && user){
    user.password = 0;
  }
  //console.log(user);
   return user
}

exports.getUserByEmail = async function (userEmail, includePassword) {
  const user = await UserSchema.findAll({
      where:{ 
           email: userEmail
      }
  })
  if(!includePassword){
    user[0].password = 0;
  }
  return user[0]
}