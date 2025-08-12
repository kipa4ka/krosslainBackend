const express = require('express');
const xml2js = require('xml2js');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

let cachedData = { categories: [], items: [] };

function parseXML(xmlData) {
    const parser = new xml2js.Parser();
    return new Promise((resolve, reject) => {
        parser.parseString(xmlData, (err, result) => {
            if (err) reject(err);
            else {
                const categories = result.shop.catalog[0].category.map(cat => ({
                    id: cat.$.id,
                    name: cat._
                }));
                const items = result.shop.items[0].item.map(item => {
                    const sizeParam = item.param.find(p => p.$.name === 'Розмір');
                    const size = sizeParam ? sizeParam._ : '';
                    return {
                        id: item.$.id,
                        categoryId: item.categoryId[0],
                        name: item.name[0],
                        priceuah: item.priceuah[0],
                        image: item.image,
                        sizes: [{ size, length: '22.5', available: item.available[0] === 'true', quantity_in_stock: item.quantity_in_stock ? item.quantity_in_stock[0] : 0 }]
                    };
                });
                resolve({ categories, items });
            }
        });
    });
}

async function updateData() {
    try {
        const response = await axios.get('https://easydrop.one/prom-export?key=24481682017071&pid=32494472342744'); // Replace with your XML URL
        const data = await parseXML(response.data);
        cachedData = data;
        console.log('Data updated at', new Date());
    } catch (error) {
        console.error('Error updating data:', error);
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
setInterval(updateData, 1800000); // Update every 30 minutes

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});