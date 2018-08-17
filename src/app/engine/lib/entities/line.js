
import * as helpers from '../ParseHelpers.js';
// export default EntityParser;

export class LineParser {
    parseEntity(scanner, curr) {
        const entity = { type: curr.value, vertices: [] };
        curr = scanner.next();
        while(curr !== 'EOF') {
            if(curr.code === 0) break;

            switch(curr.code) {
                case 10: // X coordinate of point
                    entity.vertices.unshift(helpers.parsePoint(scanner));
                    break;
                case 11:
                    entity.vertices.push(helpers.parsePoint(scanner));
                    break;
                case 210:
                    entity.extrusionDirection = helpers.parsePoint(scanner);
                    break;
                case 100:
                    break;
                default:
                    helpers.checkCommonEntityProperties(entity, curr);
                    break;
            }
            
            curr = scanner.next();
        }
        return entity;
    }
}

LineParser.ForEntityName = 'LINE';