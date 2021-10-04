#!/usr/bin/env node --max-old-space-size=4096
const {features} = require('./dist/iris.json')
const express = require('express')
const {chain, min} = require('lodash')
const Flatbush = require('flatbush')
const {bbox: getBbox, booleanPointInPolygon, point, lineString, pointToLineDistance} = require('@turf/turf')
const morgan = require('morgan')
const cors = require('cors')

async function main() {
  const app = express()

  const geoIndex = new Flatbush(features.length)
  features.forEach(f => geoIndex.add(...getBbox(f)))
  geoIndex.finish()

  if (process.env.NODE_ENV === 'production') {
    app.enable('trust proxy')
  }

  app.use(cors({origin: true}))

  if (process.env.NODE_ENV !== 'production') {
    app.use(morgan('dev'))
  }

  app.get('/iris', (req, res) => {
    if (!req.query.lat || !req.query.lon || !req.query.codeCommune) {
      return res.sendStatus(400)
    }

    const lat = Number.parseFloat(req.query.lat)
    const lon = Number.parseFloat(req.query.lon)

    if (lat > 90 || lat < -90 || lon > 180 || lon < -180) {
      return res.sendStatus(400)
    }

    const candidates = geoIndex.neighbors(lon, lat, 10, 10, undefined)
      .filter(i => features[i].properties.codeCommune === req.query.codeCommune)
      .map(i => features[i])

    if (candidates.length === 0) {
      return res.sendStatus(404)
    }

    const exactResult = candidates.find(c => {
      return booleanPointInPolygon(
        point([lon, lat]),
        c
      )
    })

    if (exactResult) {
      return res.send(exactResult.properties)
    }

    const fuzzyResult = chain(candidates)
      .minBy(c => {
        const rings = []

        if (c.geometry.type === 'Polygon') {
          rings.push(...c.geometry.coordinates)
        }

        if (c.geometry.type === 'MultiPolygon') {
          c.geometry.coordinates.forEach(polygonRings => rings.push(...polygonRings))
        }

        return min(rings.map(ring => {
          return pointToLineDistance(point([lon, lat]), lineString(ring), {units: 'kilometers'})
        }))
      })
      .value()

    if (fuzzyResult) {
      return res.send(fuzzyResult.properties)
    }

    res.sendStatus(404)
  })

  const port = process.env.PORT || 5000

  app.listen(port, () => {
    console.log(`Start listening on port ${port}`)
  })
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
