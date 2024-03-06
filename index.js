const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const mongoose = require('mongoose')
require('dotenv').config()
const productRoutes = require('./routes/product')

const app = express()

mongoose.set('strictQuery', false)
mongoose
  .connect(process.env.db || null) // db is online resource, referenced at the top
  .then((results) => false)
  .catch((e) => {
    res.json({ error: e })
  })

app.use(bodyParser.urlencoded({ extended: false }))
app.use(express.json({ limit: '4mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cors({ origin: true, credentials: true }))

app.use('/api', productRoutes)

const port = process.env.port || 8000

app.listen(port, () => false)
