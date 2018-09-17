# Experimental grants micro-service

Create text index:

```js
db.blf.createIndex(
    { Title: 'text', Description: 'text', 'Recipient Org:Name': 'text' },
    {
        weights: {
            Title: 10,
            'Recipient Org:Name': 5,
            Description: 1
        },
        name: 'TextIndex'
    }
);
```
