const axios = require("axios");

const BASE = process.env.RECOMMENDATION_API || "http://localhost:8000";

module.exports = {
  async getHomepage(userId, limit = 6) {
    const { data } = await axios.get(`${BASE}/recommend/homepage`, {
      params: { userId, limit },
      timeout: 3000,
    });
    return data.data;
  },

  async getSimilar(tourId, limit = 4) {
    const { data } = await axios.get(`${BASE}/recommend/similar`, {
      params: { tourId, limit },
      timeout: 3000,
    });
    return data.data;
  },

  async getPostBooking(tourId, userId, limit = 4) {
    const { data } = await axios.get(`${BASE}/recommend/post-booking`, {
      params: { tourId, userId, limit },
      timeout: 3000,
    });
    return data.data;
  },
};
