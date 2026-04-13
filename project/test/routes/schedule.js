const express = require("express");
const router = express.Router();
const pool = require("../db");

router.get("/", async (req,res)=>{

    const result = await pool.query(`
        SELECT * FROM schedule
        ORDER BY start_at
    `);

    res.json(result.rows);

});

module.exports = router;