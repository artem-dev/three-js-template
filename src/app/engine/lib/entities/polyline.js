
import helpers from '../ParseHelpers.js';
import VertexParser from './vertex';
export default EntityParser;

class EntityParser {
    parseEntity(scanner, curr) {
        const entity = { type: curr.value, vertices: [] };
            curr = scanner.next();
            while(curr !== 'EOF') {
                if(curr.code === 0) break;

                switch(curr.code) {
                    case 10: // always 0
                    case 20: // always 0
                    case 30: // elevation
                    case 39: // thickness
                        entity.thickness = curr.value;
                        break;
                    case 40: // start width
                    case 41: // end width
                        break;
                    case 70:
                        entity.shape = (curr.value & 1) !== 0;
                        entity.includesCurveFitVertices = (curr.value & 2) !== 0;
                        entity.includesSplineFitVertices = (curr.value & 4) !== 0;
                        entity.is3dPolyline = (curr.value & 8) !== 0;
                        entity.is3dPolygonMesh = (curr.value & 16) !== 0;
                        entity.is3dPolygonMeshClosed = (curr.value & 32) !== 0; // 32 = The polygon mesh is closed in the N direction
                        entity.isPolyfaceMesh = (curr.value & 64) !== 0;
                        entity.hasContinuousLinetypePattern = (curr.value & 128) !== 0;
                        break;
                    case 71: // Polygon mesh M vertex count
                    case 72: // Polygon mesh N vertex count
                    case 73: // Smooth surface M density
                    case 74: // Smooth surface N density
                    case 75: // Curves and smooth surface type
                        break;
                    case 210:
                        extrusionDirection = helpers.parsePoint(scanner);
                        break;
                    default:
                        helpers.checkCommonEntityProperties(entity, curr);
                        break;
                }
                curr = scanner.next();
            }

            entity.vertices = parsePolylineVertices(scanner, curr);

            return entity;
    }
}

EntityParser.ForEntityName = 'POLYLINE';

function parsePolylineVertices(scanner, curr) {
    const vertexParser = new VertexParser();

    const vertices = [];
    while (!scanner.isEOF()) {
        if (curr.code === 0) {
            if (curr.value === 'VERTEX') {
                vertices.push(vertexParser.parseEntity(scanner, curr));
                curr = scanner.lastReadGroup;
            } else if (curr.value === 'SEQEND') {
                parseSeqEnd(scanner, curr);
                break;
            }
        }
    }
    return vertices;
}

function parseSeqEnd(scanner, curr) {
    const entity = { type: curr.value };
    curr = scanner.next();
    while(curr != 'EOF') {
        if (curr.code == 0) break;
        helpers.checkCommonEntityProperties(entity, curr);
        curr = scanner.next();
    }

    return entity;
}
