#!/usr/bin/env node --max-old-space-size=4096
const {promisify} = require('util')
const {join, basename} = require('path')
const {createWriteStream} = require('fs')
const {createGzip} = require('zlib')
const {readdir, remove} = require('fs-extra')
const execa = require('execa')
const gdal = require('gdal-next')
const {stringify} = require('geojson-stream')
const {mapValues, isPlainObject} = require('lodash')
const pumpify = require('pumpify')
const bluebird = require('bluebird')
const {truncate} = require('@turf/turf')
const glob = promisify(require('glob'))
const finished = promisify(require('stream').finished)

const wgs84 = gdal.SpatialReference.fromProj4('+init=epsg:4326')

const dataDir = join(__dirname, 'data')
const distDir = join(__dirname, 'dist')
const tmpDir = join(__dirname, 'tmp')

function gdalLayerToGeoJSONFeatures(gdalLayer, transform, mapProperties) {
  return gdalLayer.features.map(feature => {
    const properties = mapProperties(feature.fields.toObject())
    const geometry = feature.getGeometry()

    if (geometry && transform) {
      geometry.transform(transform)
    }

    return {
      type: 'Feature',
      properties: mapValues(properties, v => {
        if (isPlainObject(v) && v.year && v.month && v.day) {
          return `${v.year.toString()}-${v.month.toString().padStart(2, '0')}-${v.day.toString().padStart(2, '0')}`
        }

        return v
      }),
      geometry: geometry && geometry.toObject()
    }
  })
}

async function extractToTempDirectory(archivePath) {
  const temporaryDir = join(tmpDir, basename(archivePath) + '-extraction')
  await execa('unar', [archivePath, '-o', temporaryDir])
  return temporaryDir
}

function extractFeatures(inputFile) {
  const dataset = gdal.open(inputFile)
  const layer = dataset.layers.get(0)
  const transform = layer.srs.isSame(wgs84) ?
    null :
    new gdal.CoordinateTransformation(
      layer.srs,
      wgs84
    )
  return gdalLayerToGeoJSONFeatures(layer, transform, properties => {
    const {INSEE_COM, NOM_COM, IRIS, CODE_IRIS, NOM_IRIS, TYP_IRIS} = properties

    return {
      nomCommune: NOM_COM,
      codeCommune: INSEE_COM,
      iris: IRIS,
      codeIris: CODE_IRIS,
      nomIris: NOM_IRIS,
      typeIris: TYP_IRIS
    }
  })
}

async function main() {
  await remove(tmpDir)
  const irisFile = createWriteStream(join(distDir, 'iris.json.gz'))
  const irisOutput = pumpify.obj(
    stringify(),
    createGzip(),
    irisFile
  )

  const archiveFiles = await readdir(dataDir)

  await bluebird.each(archiveFiles, async archiveFile => {
    if (!archiveFile.includes('_D0') && !archiveFile.includes('_D9')) {
      return
    }

    const temporaryDir = await extractToTempDirectory(join(dataDir, archiveFile))
    const shpFiles = await glob('**/*.shp', {cwd: temporaryDir, nocase: true})
    const shpFile = shpFiles[0]
    const features = extractFeatures(join(temporaryDir, shpFile))
    features.forEach(feature => {
      irisOutput.write(truncate(feature, {precision: 5, mutate: true}))
    })
    console.log(`Écriture de ${features.length} objets géographiques`)
    await remove(temporaryDir)
  })

  irisOutput.end()
  await finished(irisFile)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
