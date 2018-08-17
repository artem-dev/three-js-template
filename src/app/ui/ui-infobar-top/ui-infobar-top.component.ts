import { Component, OnInit } from '@angular/core';
import { DxfParser } from '../../engine/lib/DxfParser';

@Component({
  selector: 'app-ui-infobar-top',
  templateUrl: './ui-infobar-top.component.html',
  styleUrls: []
})
export class UiInfobarTopComponent implements OnInit {
  outputElement: string;

  constructor() { }

  ngOnInit() {
  }
  onChange(event: Event) {
    // console.log(event);
    const file: File = (event.target as HTMLInputElement).files[0];
    // const parser = new DxfParser();
    // console.log(parser);
    const reader = new FileReader();
    reader.readAsText(file);
    reader.onload = (e) => {
      const fileText = e.target.result;
      const parser = new DxfParser();
      console.log(parser);
      let dxf = null;
      try {
        dxf = parser.parseSync(fileText);
      } catch (err) {
        return console.error(err.stack);
      }
      console.log('Success!', dxf);
      // this.outputElement = JSON.stringify(dxf, null, 4);
    };
  }
}
