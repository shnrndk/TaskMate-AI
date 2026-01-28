const db = require('../config/db');

const getCategories = async (req, res) => {
    try {
        const userId = req.user.id;
        const [categories] = await db.query('SELECT * FROM categories WHERE user_id = ? ORDER BY name ASC', [userId]);
        res.status(200).json(categories);
    } catch (err) {
        console.error('Error fetching categories:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

const createCategory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, color } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Category name is required' });
        }

        const [result] = await db.query(
            'INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)',
            [userId, name, color || '#E94560']
        );

        res.status(201).json({ message: 'Category created', id: result.insertId, name, color });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Category already exists' });
        }
        console.error('Error creating category:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = { getCategories, createCategory };
