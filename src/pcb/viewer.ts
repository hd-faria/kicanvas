/*
    Copyright (c) 2022 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/

import { parse } from "../kicad/parser.js";
import * as pcb_items from "../kicad/pcb_items.js";
import { Viewport } from "../gfx/viewport.js";
import * as pcb_view from "../pcb/view.js";
import { WebGL2Renderer } from "../gfx/renderer.js";
import { rgba_to_f4 } from "../gfx/colorspace.js";
import * as color_theme from "../kicad/color_theme";
import { Vec2 } from "../math/vec2.js";
import { TextShaper } from "../gfx/text.js";
import { BBox } from "../math/bbox.js";

export class Viewer {
    #cvs;
    #renderer;
    #viewport;
    #view;
    pcb;
    selected: any;
    selected_bbox: BBox;

    constructor(canvas) {
        this.#cvs = canvas;
        this.#renderer = new WebGL2Renderer(
            this.#cvs,
            rgba_to_f4(color_theme.board.background));

        this.#cvs.addEventListener("click", (e) => {
            const rect = this.#cvs.getBoundingClientRect();
            const mouse = this.#viewport.screen_to_world(
                new Vec2(e.clientX - rect.left, e.clientY - rect.top)
            );

            this.selected = null;

            for (const layer of this.layers.in_display_order()) {
                if (layer.visible && layer.enabled) {
                    for (const [item, bb] of layer.bboxes.entries()) {
                        if (bb.contains_point(mouse)) {
                            this.selected = item;
                            this.selected_bbox = bb;
                            break;
                        }
                    }
                }

                if (this.selected) {
                    break;
                }
            }

            console.log("Selected", this.selected);
            this.show_selected();
            this.draw();
        });
    }

    async setup() {
        await this.#renderer.setup();
        this.#renderer.context.text_shaper = await TextShaper.default();

        this.#viewport = new Viewport(this.#renderer, () => {
            this.draw();
        });
        this.#viewport.enable_pan_and_zoom(0.3, 200);
    }

    async load(url) {
        const pcb_src = await (await window.fetch(url)).text();
        this.pcb = new pcb_items.KicadPCB(parse(pcb_src));

        this.#view = new pcb_view.View(this.#renderer, this.pcb, color_theme.board);
        this.#view.setup();

        this.#look_at_board();
        this.draw();
    }

    #look_at_board() {
        const board_bbox = this.#view.get_board_bbox();
        this.#viewport.camera.bbox = board_bbox.grow(board_bbox.w * 0.1);
    }

    draw() {
        if (!this.#view) return;

        window.requestAnimationFrame(() => {
            this.#renderer.clear_canvas();
            const matrix = this.#viewport.view_projection_matrix;
            this.#view.draw(matrix);
        });
    }

    get layers() {
        return this.#view.layers;
    }

    show_selected() {
        const bb = this.selected_bbox.copy().grow(this.selected_bbox.w * 0.3);
        const layer = this.layers.by_name(":Overlay");

        layer.graphics?.dispose();

        this.#renderer.start_layer();

        this.#renderer.line(
            [
                bb.top_left,
                bb.top_right,
                bb.bottom_right,
                bb.bottom_left,
                bb.top_left,
            ],
            1,
            [1, 1, 1, 1]
        );

        layer.graphics = this.#renderer.end_layer();
    }
}