
import helpers from '../ParseHelpers.js';
export default EntityParser;

class EntityParser {
    parseEntity(scanner, curr) {
        let entity, endAngle;
        entity = { type: curr.value };
        curr = scanner.next();
        while(curr !== 'EOF') {
            if(curr.code === 0) break;

            switch(curr.code) {
                case 10: // X coordinate of point
                    entity.center = helpers.parsePoint(scanner);
                    break;
                case 40: // radius
                    entity.radius = curr.value;
                    break;
                case 50: // start angle
                    entity.startAngle = Math.PI / 180 * curr.value;
                    break;
                case 51: // end angle
                    endAngle = Math.PI / 180 * curr.value;
                    if(endAngle < entity.startAngle)
                        entity.angleLength = endAngle + 2 * Math.PI - entity.startAngle;
                    else
                        entity.angleLength = endAngle - entity.startAngle;
                    entity.endAngle = endAngle;
                    break;
                default: // ignored attribute
                    helpers.checkCommonEntityProperties(entity, curr);
                    break;
            }
            curr = scanner.next();
        }
        return entity;
    }
}

EntityParser.ForEntityName = 'CIRCLE';