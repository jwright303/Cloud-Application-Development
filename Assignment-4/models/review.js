const { DataTypes } = require('sequelize')

const sequelize = require('../lib/sequelize')

const Review = sequelize.define('review', {
  userId: { type: DataTypes.INTEGER, allowNull: false },
  dollars: { type: DataTypes.INTEGER, allowNull: false },
  stars: { type: DataTypes.INTEGER, allowNull: false },
  review: { type: DataTypes.TEXT, allowNull: true }
})

exports.Review = Review
exports.ReviewClientFields = [
  'userId',
  'dollars',
  'stars',
  'review',
  'businessId'
]
