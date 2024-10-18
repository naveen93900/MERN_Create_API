const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  title: String,
  description: String,
  price: Number,
  category: String,
  sold: Boolean,
  dateOfSale: String // Format: YYYY-MM-DD
});

module.exports = mongoose.model('Product', productSchema);
