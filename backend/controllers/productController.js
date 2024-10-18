const axios = require('axios');
const Product = require('../models/Product');
const priceRanges = require('../utils/priceRanges');

// Initialize database with data from third-party API
const initializeDatabase = async (req, res) => {
  try {
    const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    await Product.deleteMany({});
    await Product.insertMany(response.data);
    res.status(200).json({ message: 'Database initialized with seed data' });
  } catch (error) {
    res.status(500).json({ error: 'Database initialization failed' });
  }
};

// Get transactions with pagination and search
const getTransactions = async (req, res) => {
  const { page = 1, perPage = 10, search = '', month } = req.query;
  const searchRegex = new RegExp(search, 'i');
  const monthRegex = new RegExp(`-${month.padStart(2, '0')}-`);
  
  const query = {
    $and: [
      { dateOfSale: { $regex: monthRegex } },
      { $or: [{ title: searchRegex }, { description: searchRegex }, { price: searchRegex }] }
    ]
  };

  const total = await Product.countDocuments(query);
  const transactions = await Product.find(query)
    .skip((page - 1) * perPage)
    .limit(Number(perPage));

  res.json({ transactions, total, currentPage: page, totalPages: Math.ceil(total / perPage) });
};

// Get statistics for a selected month
const getStatistics = async (req, res) => {
  const { month } = req.query;
  const monthRegex = new RegExp(`-${month.padStart(2, '0')}-`);

  const totalSaleAmount = await Product.aggregate([
    { $match: { dateOfSale: { $regex: monthRegex } } },
    { $group: { _id: null, total: { $sum: '$price' } } }
  ]);

  const totalSoldItems = await Product.countDocuments({ dateOfSale: { $regex: monthRegex }, sold: true });
  const totalNotSoldItems = await Product.countDocuments({ dateOfSale: { $regex: monthRegex }, sold: false });

  res.json({ totalSaleAmount: totalSaleAmount[0]?.total || 0, totalSoldItems, totalNotSoldItems });
};

// Get bar chart data for price range
const getBarChart = async (req, res) => {
  const { month } = req.query;
  const monthRegex = new RegExp(`-${month.padStart(2, '0')}-`);

  const results = await Promise.all(priceRanges.map(async (range) => {
    const count = await Product.countDocuments({
      dateOfSale: { $regex: monthRegex },
      price: { $gte: range.min, $lt: range.max === Infinity ? 100000 : range.max }
    });
    return { range: range.label, count };
  }));

  res.json(results);
};

// Get pie chart data for categories
const getPieChart = async (req, res) => {
  const { month } = req.query;
  const monthRegex = new RegExp(`-${month.padStart(2, '0')}-`);

  const categories = await Product.aggregate([
    { $match: { dateOfSale: { $regex: monthRegex } } },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);

  res.json(categories.map(c => ({ category: c._id, count: c.count })));
};

// Get combined data (transactions, statistics, bar chart, pie chart)
const getCombinedData = async (req, res) => {
  const { month } = req.query;
  const transactions = await getTransactions(req, res);
  const statistics = await getStatistics(req, res);
  const barChart = await getBarChart(req, res);
  const pieChart = await getPieChart(req, res);

  res.json({ transactions, statistics, barChart, pieChart });
};

module.exports = {
  initializeDatabase,
  getTransactions,
  getStatistics,
  getBarChart,
  getPieChart,
  getCombinedData
};
