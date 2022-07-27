const { Sequelize } = require('sequelize')
const sequelize = new Sequelize({
    dialect: 'mysql',
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || 3306,
    database: process.env.MYSQL_DB_NAME ||"tarpaulin",
    username: process.env.MYSQL_USER || "tarpaulin",
    password: process.env.MYSQL_PASSWORD || "hunter2"
})

module.exports = sequelize
