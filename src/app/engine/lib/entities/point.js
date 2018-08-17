
import helpers from '../ParseHelpers.js';
export default EntityParser;

class EntityParser {
    parseEntity(scanner, curr) {
        let entity;
        entity = { type: curr.value };
        curr = scanner.next();
        while(curr !== 'EOF') {
            if(curr.code === 0) break;

            switch(curr.code) {
                case 10:
                    entity.position = helpers.parsePoint(scanner);
                    break;
                case 39:
                    entity.thickness = curr.value;
                    break;
                case 210:
                    entity.extrusionDirection = helpers.parsePoint(scanner);
                    break;
                case 100:
                    break;
                default: // check common entity attributes
                    helpers.checkCommonEntityProperties(entity, curr);
                    break;
            }
            curr = scanner.next();
        }

        return entity;
    }
}

EntityParser.ForEntityName = 'POINT';