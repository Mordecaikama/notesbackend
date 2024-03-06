const mongoose = require('mongoose')
const { ObjectId } = mongoose.Schema

const ProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please enter product name'],
      unique: true,
      maxlength: 32,
    },

    description: {
      type: String,
      required: [true, 'Please enter product description'],
    },
    price: {
      type: Number,
      required: [true, 'please enter product price'],
      maxlength: 32,
    },
  },
  { timestamps: true }
)

const Product = mongoose.model('Product', ProductSchema)

module.exports = Product
