import { Component, OnInit, ElementRef, ViewChild } from '@angular/core';
import { EngineService } from './engine.service';

@Component({
  selector: 'app-engine',
  templateUrl: './engine.component.html',
  styleUrls: [],
})
export class EngineComponent implements OnInit {
  @ViewChild('canvas')
    private canvasRef: ElementRef;

  constructor(private engServ: EngineService) { }

  ngOnInit() {
    this.engServ.createScene(this.canvasRef);
    this.engServ.animate();
  }

}
