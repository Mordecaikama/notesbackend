const express = require('express')
const Product = require('../models/product')
const router = express.Router()

const productById = (req, res, next, id) => {
  Product.findById(id).exec((err, prod) => {
    if (err || !prod) {
      return res.status(400).json({ error: 'product not exist' })
    }
    req.product = prod
    next()
  })
}

router.get('/product/:productId', (req, res) => {
  res.json({ data: req.product })
})

router.get('/products', (req, res) => {
  Product.find({}, (err, prod) => {
    if (err || !prod) {
      res.json({ data: err })
    }
    res.json({ data: prod })
  })
})

router.post('/product', (req, res) => {
  s
  const prod = new Product(req.body)

  prod.save((err, data) => {
    if (err) {
      res.json({ errpr: err })
    }
    res.json({
      data,
    })
  })
})

router.patch('/product/:productId', (req, res) => {
  Product.findOneAndUpdate(
    { _id: req.product._id },
    { $set: req.body },
    { new: true },
    (err, doc) => {
      if (err) {
        return res.status(400).json({
          error: 'product does not exist',
        })
      }
      res.json({ data: doc })
    }
  )
})

router.delete('/product/:productId', (req, res) => {
  const product = req.product
  product.remove((err, data) => {
    if (err) {
      return res.status(400).json({
        error: 'product could not be deleted',
      })
    }
    if (data) {
      res.json({
        data: 'product removed successfully',
      })
    }
  })
})

router.param('productId', productById)

module.exports = router
