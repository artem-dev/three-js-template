export class DxfParser {

    constructor();

    parseSync (source:string): string;

    parseStream (stream:any, done: () => void): void;
}