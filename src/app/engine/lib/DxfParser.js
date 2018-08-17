import DxfArrayScanner from './DxfArrayScanner.js';
import AUTO_CAD_COLOR_INDEX from './AutoCadColorIndex.js';
import log from 'loglevel';
import { ThreefaceParcer } from './entities/3dface';
import { LineParser } from './entities/line';
// import * from './entities/text';
//log.setLevel('trace');
//log.setLevel('debug');
//log.setLevel('info');
//log.setLevel('warn');
// log.setLevel('error');
//log.setLevel('silent');

function registerDefaultEntityHandlers(dxfParser) {
    // Supported entities here (some entity code is still being refactored into this flow)
    // import('./entities/3dface').then((something) => {
    //     console.log(something.default);
    //  });
    // dxfParser.registerEntityHandler(import('./entities/3dface'));
    // dxfParser.registerEntityHandler(import('./entities/arc'));
    // dxfParser.registerEntityHandler(import('./entities/attdef'));
    // dxfParser.registerEntityHandler(import('./entities/circle'));
    // dxfParser.registerEntityHandler(import('./entities/dimension'));
    // dxfParser.registerEntityHandler(import('./entities/ellipse'));
    // dxfParser.registerEntityHandler(import('./entities/insert'));
    // dxfParser.registerEntityHandler(import('./entities/line'));
    // dxfParser.registerEntityHandler(import('./entities/lwpolyline'));
    // dxfParser.registerEntityHandler(import('./entities/mtext'));
    // dxfParser.registerEntityHandler(import('./entities/point'));
    // dxfParser.registerEntityHandler(import('./entities/polyline'));
    // dxfParser.registerEntityHandler(import('./entities/solid'));
    // dxfParser.registerEntityHandler(import('./entities/spline'));
    // dxfParser.registerEntityHandler(import('./entities/text'));
    //dxfParser.registerEntityHandler( import('./entities/vertex'));
}

export class DxfParser {
    constructor() {
        this._entityHandlers = {};
        let instance = null;
        instance = new ThreefaceParcer();
        this._entityHandlers[ThreefaceParcer.ForEntityName] = instance;
        instance = new LineParser();
        this._entityHandlers[LineParser.ForEntityName] = instance;
        // registerDefaultEntityHandlers(this);
    }

    parse(source, done) {
        throw new Error("read() not implemented. Use readSync()");
    }

    registerEntityHandler(handlerType) {
        const instance = new handlerType();
        this._entityHandlers[handlerType.ForEntityName] = instance;
    }

    parseSync(source) {
        if (typeof (source) === 'string') {
            return this._parse(source);
        } else {
            console.error('Cannot read dxf source of type `' + typeof (source));
            return null;
        }
    }

    parseStream(stream, done) {

        let dxfString = "";
        const self = this;

        stream.on('data', onData);
        stream.on('end', onEnd);
        stream.on('error', onError);

        function onData(chunk) {
            dxfString += chunk;
        }

        function onEnd() {
            try {
                var dxf = self._parse(dxfString);
            } catch (err) {
                return done(err);
            }
            done(null, dxf);
        }

        function onError(err) {
            done(err);
        }
    }

    _parse(dxfString) {
        let scanner;
        let curr;
        const dxf = {};
        let lastHandle = 0;
        const dxfLinesArray = dxfString.split(/\r\n|\r|\n/g);

        scanner = new DxfArrayScanner(dxfLinesArray);
        if (!scanner.hasNext()) throw Error('Empty file');

        const self = this;

        const parseAll = () => {
            curr = scanner.next();
            while (!scanner.isEOF()) {
                if (curr.code === 0 && curr.value === 'SECTION') {
                    curr = scanner.next();

                    // Be sure we are reading a section code
                    if (curr.code !== 2) {
                        console.error('Unexpected code %s after 0:SECTION', debugCode(curr));
                        curr = scanner.next();
                        continue;
                    }

                    if (curr.value === 'HEADER') {
                        log.debug('> HEADER');
                        dxf.header = parseHeader();
                        log.debug('<');
                    } else if (curr.value === 'BLOCKS') {
                        log.debug('> BLOCKS');
                        dxf.blocks = parseBlocks();
                        log.debug('<');
                    } else if (curr.value === 'ENTITIES') {
                        log.debug('> ENTITIES');
                        dxf.entities = parseEntities(false);
                        log.debug('<');
                    } else if (curr.value === 'TABLES') {
                        log.debug('> TABLES');
                        dxf.tables = parseTables();
                        log.debug('<');
                    } else if (curr.value === 'EOF') {
                        log.debug('EOF');
                    } else {
                        log.warn('Skipping section \'%s\'', curr.value);
                    }
                } else {
                    curr = scanner.next();
                }
                // If is a new section
            }
        };

        const groupIs = (code, value) => curr.code === code && curr.value === value;

        /**
         *
         * @return {object} header
         */
        var parseHeader = () => {
            // interesting variables:
            //  $ACADVER, $VIEWDIR, $VIEWSIZE, $VIEWCTR, $TDCREATE, $TDUPDATE
            // http://www.autodesk.com/techpubs/autocad/acadr14/dxf/header_section_al_u05_c.htm
            // Also see VPORT table entries
            let currVarName = null, currVarValue = null;
            const header = {};
            // loop through header variables
            curr = scanner.next();

            while (true) {
                if (groupIs(0, 'ENDSEC')) {
                    if (currVarName) header[currVarName] = currVarValue;
                    break;
                } else if (curr.code === 9) {
                    if (currVarName) header[currVarName] = currVarValue;
                    currVarName = curr.value;
                    // Filter here for particular variables we are interested in
                } else {
                    if (curr.code === 10) {
                        currVarValue = { x: curr.value };
                    } else if (curr.code === 20) {
                        currVarValue.y = curr.value;
                    } else if (curr.code === 30) {
                        currVarValue.z = curr.value;
                    } else {
                        currVarValue = curr.value;
                    }
                }
                curr = scanner.next();
            }
            // console.log(util.inspect(header, { colors: true, depth: null }));
            curr = scanner.next(); // swallow up ENDSEC
            return header;
        };


        /**
         *
         */
        var parseBlocks = () => {
            const blocks = {};
            let block;

            curr = scanner.next();

            while (curr.value !== 'EOF') {
                if (groupIs(0, 'ENDSEC')) {
                    break;
                }

                if (groupIs(0, 'BLOCK')) {
                    log.debug('block {');
                    block = parseBlock();
                    log.debug('}');
                    ensureHandle(block);
                    if (!block.name)
                        log.error('block with handle "' + block.handle + '" is missing a name.');
                    else
                        blocks[block.name] = block;
                } else {
                    logUnhandledGroup(curr);
                    curr = scanner.next();
                }
            }
            return blocks;
        };

        var parseBlock = () => {
            const block = {};
            curr = scanner.next();

            while (curr.value !== 'EOF') {
                switch (curr.code) {
                    case 1:
                        block.xrefPath = curr.value;
                        curr = scanner.next();
                        break;
                    case 2:
                        block.name = curr.value;
                        curr = scanner.next();
                        break;
                    case 3:
                        block.name2 = curr.value;
                        curr = scanner.next();
                        break;
                    case 5:
                        block.handle = curr.value;
                        curr = scanner.next();
                        break;
                    case 8:
                        block.layer = curr.value;
                        curr = scanner.next();
                        break;
                    case 10:
                        block.position = parsePoint();
                        curr = scanner.next();
                        break;
                    case 67:
                        block.paperSpace = (curr.value && curr.value == 1) ? true : false;
                        curr = scanner.next();
                        break;
                    case 70:
                        if (curr.value != 0) {
                            //if(curr.value & BLOCK_ANONYMOUS_FLAG) console.log('  Anonymous block');
                            //if(curr.value & BLOCK_NON_CONSTANT_FLAG) console.log('  Non-constant attributes');
                            //if(curr.value & BLOCK_XREF_FLAG) console.log('  Is xref');
                            //if(curr.value & BLOCK_XREF_OVERLAY_FLAG) console.log('  Is xref overlay');
                            //if(curr.value & BLOCK_EXTERNALLY_DEPENDENT_FLAG) console.log('  Is externally dependent');
                            //if(curr.value & BLOCK_RESOLVED_OR_DEPENDENT_FLAG) console.log('  Is resolved xref or dependent of an xref');
                            //if(curr.value & BLOCK_REFERENCED_XREF) console.log('  This definition is a referenced xref');
                            block.type = curr.value;
                        }
                        curr = scanner.next();
                        break;
                    case 100:
                        // ignore class markers
                        curr = scanner.next();
                        break;
                    case 330:
                        block.ownerHandle = curr.value;
                        curr = scanner.next();
                        break;
                    case 0:
                        if (curr.value == 'ENDBLK')
                            break;
                        block.entities = parseEntities(true);
                        break;
                    default:
                        logUnhandledGroup(curr);
                        curr = scanner.next();
                }

                if (groupIs(0, 'ENDBLK')) {
                    curr = scanner.next();
                    break;
                }
            }
            return block;
        };

        /**
         * parseTables
         * @return {Object} Object representing tables
         */
        var parseTables = () => {
            const tables = {};
            curr = scanner.next();
            while (curr.value !== 'EOF') {
                if (groupIs(0, 'ENDSEC'))
                    break;

                if (groupIs(0, 'TABLE')) {
                    curr = scanner.next();

                    const tableDefinition = tableDefinitions[curr.value];
                    if (tableDefinition) {
                        log.debug(curr.value + ' Table {');
                        tables[tableDefinitions[curr.value].tableName] = parseTable();
                        log.debug('}');
                    } else {
                        log.debug('Unhandled Table ' + curr.value);
                    }
                } else {
                    // else ignored
                    curr = scanner.next();
                }
            }

            curr = scanner.next();
            return tables;
        };

        const END_OF_TABLE_VALUE = 'ENDTAB';

        var parseTable = () => {
            const tableDefinition = tableDefinitions[curr.value];
            const table = {};
            let expectedCount = 0;
            let actualCount;

            curr = scanner.next();
            while (!groupIs(0, END_OF_TABLE_VALUE)) {

                switch (curr.code) {
                    case 5:
                        table.handle = curr.value;
                        curr = scanner.next();
                        break;
                    case 330:
                        table.ownerHandle = curr.value;
                        curr = scanner.next();
                        break;
                    case 100:
                        if (curr.value === 'AcDbSymbolTable') {
                            // ignore
                            curr = scanner.next();
                        } else {
                            logUnhandledGroup(curr);
                            curr = scanner.next();
                        }
                        break;
                    case 70:
                        expectedCount = curr.value;
                        curr = scanner.next();
                        break;
                    case 0:
                        if (curr.value === tableDefinition.dxfSymbolName) {
                            table[tableDefinition.tableRecordsProperty] = tableDefinition.parseTableRecords();
                        } else {
                            logUnhandledGroup(curr);
                            curr = scanner.next();
                        }
                        break;
                    default:
                        logUnhandledGroup(curr);
                        curr = scanner.next();
                }
            }
            const tableRecords = table[tableDefinition.tableRecordsProperty];
            if (tableRecords) {
                if (tableRecords.constructor === Array) {
                    actualCount = tableRecords.length;
                } else if (typeof (tableRecords) === 'object') {
                    actualCount = Object.keys(tableRecords).length;
                }
                if (expectedCount !== actualCount) log.warn('Parsed ' + actualCount + ' ' + tableDefinition.dxfSymbolName + '\'s but expected ' + expectedCount);
            }
            curr = scanner.next();
            return table;
        };

        const parseViewPortRecords = () => {
            const // Multiple table entries may have the same name indicating a multiple viewport configuration
                viewPorts = [];

            let viewPort = {};

            log.debug('ViewPort {');
            curr = scanner.next();
            while (!groupIs(0, END_OF_TABLE_VALUE)) {

                switch (curr.code) {
                    case 2: // layer name
                        viewPort.name = curr.value;
                        curr = scanner.next();
                        break;
                    case 10:
                        viewPort.lowerLeftCorner = parsePoint();
                        curr = scanner.next();
                        break;
                    case 11:
                        viewPort.upperRightCorner = parsePoint();
                        curr = scanner.next();
                        break;
                    case 12:
                        viewPort.center = parsePoint();
                        curr = scanner.next();
                        break;
                    case 13:
                        viewPort.snapBasePoint = parsePoint();
                        curr = scanner.next();
                        break;
                    case 14:
                        viewPort.snapSpacing = parsePoint();
                        curr = scanner.next();
                        break;
                    case 15:
                        viewPort.gridSpacing = parsePoint();
                        curr = scanner.next();
                        break;
                    case 16:
                        viewPort.viewDirectionFromTarget = parsePoint();
                        curr = scanner.next();
                        break;
                    case 17:
                        viewPort.viewTarget = parsePoint();
                        curr = scanner.next();
                        break;
                    case 42:
                        viewPort.lensLength = curr.value;
                        curr = scanner.next();
                        break;
                    case 43:
                        viewPort.frontClippingPlane = curr.value;
                        curr = scanner.next();
                        break;
                    case 44:
                        viewPort.backClippingPlane = curr.value;
                        curr = scanner.next();
                        break;
                    case 45:
                        viewPort.viewHeight = curr.value;
                        curr = scanner.next();
                        break;
                    case 50:
                        viewPort.snapRotationAngle = curr.value;
                        curr = scanner.next();
                        break;
                    case 51:
                        viewPort.viewTwistAngle = curr.value;
                        curr = scanner.next();
                        break;
                    case 79:
                        viewPort.orthographicType = curr.value;
                        curr = scanner.next();
                        break;
                    case 110:
                        viewPort.ucsOrigin = parsePoint();
                        curr = scanner.next();
                        break;
                    case 111:
                        viewPort.ucsXAxis = parsePoint();
                        curr = scanner.next();
                        break;
                    case 112:
                        viewPort.ucsYAxis = parsePoint();
                        curr = scanner.next();
                        break;
                    case 110:
                        viewPort.ucsOrigin = parsePoint();
                        curr = scanner.next();
                        break;
                    case 281:
                        viewPort.renderMode = curr.value;
                        curr = scanner.next();
                        break;
                    case 281:
                        // 0 is one distant light, 1 is two distant lights
                        viewPort.defaultLightingType = curr.value;
                        curr = scanner.next();
                        break;
                    case 292:
                        viewPort.defaultLightingOn = curr.value;
                        curr = scanner.next();
                        break;
                    case 330:
                        viewPort.ownerHandle = curr.value;
                        curr = scanner.next();
                        break;
                    case 63:
                    case 421:
                    case 431:
                        viewPort.ambientColor = curr.value;
                        curr = scanner.next();
                        break;
                    case 0:
                        // New ViewPort
                        if (curr.value === 'VPORT') {
                            log.debug('}');
                            viewPorts.push(viewPort);
                            log.debug('ViewPort {');
                            viewPort = {};
                            curr = scanner.next();
                        }
                        break;
                    default:
                        logUnhandledGroup(curr);
                        curr = scanner.next();
                        break;
                }
            }
            // Note: do not call scanner.next() here,
            //  parseTable() needs the current group
            log.debug('}');
            viewPorts.push(viewPort);

            return viewPorts;
        };

        const parseLineTypes = () => {
            const ltypes = {};
            let ltypeName;
            let ltype = {};
            let length;

            log.debug('LType {');
            curr = scanner.next();
            while (!groupIs(0, 'ENDTAB')) {

                switch (curr.code) {
                    case 2:
                        ltype.name = curr.value;
                        ltypeName = curr.value;
                        curr = scanner.next();
                        break;
                    case 3:
                        ltype.description = curr.value;
                        curr = scanner.next();
                        break;
                    case 73: // Number of elements for this line type (dots, dashes, spaces);
                        length = curr.value;
                        if (length > 0) ltype.pattern = [];
                        curr = scanner.next();
                        break;
                    case 40: // total pattern length
                        ltype.patternLength = curr.value;
                        curr = scanner.next();
                        break;
                    case 49:
                        ltype.pattern.push(curr.value);
                        curr = scanner.next();
                        break;
                    case 0:
                        log.debug('}');
                        if (length > 0 && length !== ltype.pattern.length) log.warn('lengths do not match on LTYPE pattern');
                        ltypes[ltypeName] = ltype;
                        ltype = {};
                        log.debug('LType {');
                        curr = scanner.next();
                        break;
                    default:
                        curr = scanner.next();
                }
            }

            log.debug('}');
            ltypes[ltypeName] = ltype;
            return ltypes;
        };

        const parseLayers = () => {
            const layers = {};
            let layerName;
            let layer = {};

            log.debug('Layer {');
            curr = scanner.next();
            while (!groupIs(0, 'ENDTAB')) {

                switch (curr.code) {
                    case 2: // layer name
                        layer.name = curr.value;
                        layerName = curr.value;
                        curr = scanner.next();
                        break;
                    case 62: // color, visibility
                        layer.visible = curr.value >= 0;
                        // TODO 0 and 256 are BYBLOCK and BYLAYER respectively. Need to handle these values for layers?.
                        layer.color = getAcadColor(Math.abs(curr.value));
                        curr = scanner.next();
                        break;
                    case 70: // frozen layer
                        layer.frozen = ((curr.value & 1) != 0 || (curr.value & 2) != 0);
                        curr = scanner.next();
                        break;
                    case 0:
                        // New Layer
                        if (curr.value === 'LAYER') {
                            log.debug('}');
                            layers[layerName] = layer;
                            log.debug('Layer {');
                            layer = {};
                            layerName = undefined;
                            curr = scanner.next();
                        }
                        break;
                    default:
                        logUnhandledGroup(curr);
                        curr = scanner.next();
                        break;
                }
            }
            // Note: do not call scanner.next() here,
            //  parseLayerTable() needs the current group
            log.debug('}');
            layers[layerName] = layer;

            return layers;
        };

        var tableDefinitions = {
            VPORT: {
                tableRecordsProperty: 'viewPorts',
                tableName: 'viewPort',
                dxfSymbolName: 'VPORT',
                parseTableRecords: parseViewPortRecords
            },
            LTYPE: {
                tableRecordsProperty: 'lineTypes',
                tableName: 'lineType',
                dxfSymbolName: 'LTYPE',
                parseTableRecords: parseLineTypes
            },
            LAYER: {
                tableRecordsProperty: 'layers',
                tableName: 'layer',
                dxfSymbolName: 'LAYER',
                parseTableRecords: parseLayers
            }
        };

        /**
         * Is called after the parser first reads the 0:ENTITIES group. The scanner
         * should be on the start of the first entity already.
         * @return {Array} the resulting entities
         */
        var parseEntities = forBlock => {
            const entities = [];

            const endingOnValue = forBlock ? 'ENDBLK' : 'ENDSEC';

            if (!forBlock) {
                curr = scanner.next();
            }
            while (true) {

                if (curr.code === 0) {
                    if (curr.value === endingOnValue) {
                        break;
                    }

                    let entity;
                    const handler = self._entityHandlers[curr.value];
                    if (handler != null) {
                        log.debug(curr.value + ' {');
                        entity = handler.parseEntity(scanner, curr);
                        curr = scanner.lastReadGroup;
                        log.debug('}');
                    } else {
                        log.warn('Unhandled entity ' + curr.value);
                        curr = scanner.next();
                        continue;
                    }
                    ensureHandle(entity);
                    entities.push(entity);
                } else {
                    // ignored lines from unsupported entity
                    curr = scanner.next();
                }
            }
            if (endingOnValue == 'ENDSEC') curr = scanner.next(); // swallow up ENDSEC, but not ENDBLK
            return entities;
        };

        /**
         * Parses a 2D or 3D point, returning it as an object with x, y, and
         * (sometimes) z property if it is 3D. It is assumed the current group
         * is x of the point being read in, and scanner.next() will return the
         * y. The parser will determine if there is a z point automatically.
         * @return {Object} The 2D or 3D point as an object with x, y[, z]
         */
        var parsePoint = () => {
            const point = {};
            let code = curr.code;

            point.x = curr.value;

            code += 10;
            curr = scanner.next();
            if (curr.code != code)
                throw new Error('Expected code for point value to be ' + code +
                    ' but got ' + curr.code + '.');
            point.y = curr.value;

            code += 10;
            curr = scanner.next();
            if (curr.code != code) {
                scanner.rewind();
                return point;
            }
            point.z = curr.value;

            return point;
        };

        var ensureHandle = entity => {
            if (!entity) throw new TypeError('entity cannot be undefined or null');

            if (!entity.handle) entity.handle = lastHandle++;
        };

        parseAll();
        return dxf;
    }
}

function logUnhandledGroup(curr) {
    log.debug('unhandled group ' + debugCode(curr));
}


function debugCode(curr) {
    return curr.code + ':' + curr.value;
}

/**
 * Returns the truecolor value of the given AutoCad color index value
 * @return {Number} truecolor value as a number
 */
function getAcadColor(index) {
    return AUTO_CAD_COLOR_INDEX[index];
}

const BLOCK_ANONYMOUS_FLAG = 1;
const BLOCK_NON_CONSTANT_FLAG = 2;
const BLOCK_XREF_FLAG = 4;
const BLOCK_XREF_OVERLAY_FLAG = 8;
const BLOCK_EXTERNALLY_DEPENDENT_FLAG = 16;
const BLOCK_RESOLVED_OR_DEPENDENT_FLAG = 32;
const BLOCK_REFERENCED_XREF = 64;



export default DxfParser;


/* Notes */
// Code 6 of an entity indicates inheritance of properties (eg. color).
//   BYBLOCK means inherits from block
//   BYLAYER (default) mean inherits from layer