const express = require('express');
const xml2js = require('xml2js');
const axios = require('axios');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

let cachedData = { categories: [], items: [] };

async function parseXML(xmlData) {
    const parser = new xml2js.Parser();
    return new Promise((resolve, reject) => {
        parser.parseString(xmlData, (err, result) => {
            if (err) return reject(err);

            const categories = result.shop.catalog[0].category.map(cat => ({
                id: cat.$.id,
                name: cat._
            }));

            const groups = new Map();
            result.shop.items[0].item.forEach(item => {
                const groupId = item.$.group_id;
                if (!groups.has(groupId)) {
                    groups.set(groupId, {
                        groupId,
                        categoryId: item.categoryId[0],
                        name: item.name[0],
                        priceuah: item.priceuah[0],
                        description: item.description ? item.description[0] : '',
                        images: item.image || [],
                        sizes: {},
                        maxId: 0,
                        barcode: item.barcode ? item.barcode[0] : 'Немає артикула' // Додаємо barcode
                    });
                }
                const group = groups.get(groupId);
                const itemId = parseInt(item.$.id) || 0;
                if (itemId > group.maxId) group.maxId = itemId;

                const available = item.available[0] === 'true';
                const param = item.param ? item.param.find(p => p.$.name === 'Розмір') : null;
                const size = param ? parseInt(param._) : null;
                const quantity = item.quantity_in_stock ? parseInt(item.quantity_in_stock[0]) : 0;

                if (available && size && quantity > 0) {
                    group.sizes[size] = quantity;
                }
            });

            const items = Array.from(groups.values()).filter(g => Object.keys(g.sizes).length > 0);
            resolve({ categories, items });
        });
    });
}

async function updateData() {
    try {
        const response = await axios.get('https://easydrop.one/prom-export?key=24481682017071&pid=32494472342744');
        const data = await parseXML(response.data);
        cachedData = data;
        console.log('Updated categories:', cachedData.categories.length);
        console.log('Updated items:', cachedData.items.length);
    } catch (error) {
        console.error('Error updating data:', error.message);
    }
}

app.get('/api/products', (req, res) => {
    let items = cachedData.items;
    if (req.query.category && req.query.category !== 'all') {
        items = items.filter(item => item.categoryId === req.query.category);
    }
    res.json({ categories: cachedData.categories, items });
});

updateData();
setInterval(updateData, 1800000);

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});