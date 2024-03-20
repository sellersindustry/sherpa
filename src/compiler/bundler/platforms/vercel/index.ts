/*
 *   Copyright (C) 2024 Sellers Industries, Inc.
 *   distributed under the MIT License
 *
 *   author: Evan Sellers <sellersew@gmail.com>
 *   date: Wed Mar 20 2024
 *   file: index.ts
 *   project: SherpaJS - Module Microservice Platform
 *   purpose: Vercel Builder
 *
 */


import fs from "fs";
import { Bundler } from "../abstract.js";
import { Endpoint } from "../../../models.js";
import { Files } from "../../../utilities/files/index.js";
import { Tooling } from "../../../utilities/tooling/index.js";
import { RequestUtilities } from "../../../../environment/io/request/utilities.js";


export class Vercel extends Bundler {


    getFilepath():string {
        return Files.join(this.options.output, ".vercel");
    }


    async build() {
        await super.build();
        this.makeDirectory();
        this.writeRootConfig();
        for (let endpoint of this.endpoints) {
            let route = RequestUtilities.getDynamicURL(endpoint.segments);
            let path  = this.getDirectory(route, "index.func");
            this.writeEndpointConfig(path);
            await Tooling.build({
                buffer:  this.getBuffer(endpoint),
                output:  Files.join(path, "index.js"),
                resolve: Files.getDirectory(endpoint.filepath),
                options: { 
                    ...this.options?.developer?.bundler?.esbuild,
                    platform: "node",
                }
            });
        }
    }


    private getBuffer(endpoint:Endpoint) {
        return `
            import { __internal__ as SherpaJS } from "${Files.unix(Files.join(Files.getRootDirectory(), "dist/src/environment/index.js"))}";
            import * as endpoint from "${Files.unix(endpoint.filepath)}";
            import import_context from "${Files.unix(endpoint.module.contextFilepath)}";

            let context  = import_context.context;
            let segments = ${JSON.stringify(endpoint.segments)};
            let url      = "${RequestUtilities.getDynamicURL(endpoint.segments)}";

            export default async function index(nativeRequest, event) {
                let req = await SherpaJS.RequestTransform.Vercel(nativeRequest, segments);
                let res = await SherpaJS.Handler(endpoint, context, req);
                SherpaJS.ResponseTransform.Vercel(res, nativeResponse);
            }
        `;
    }



    private getDirectory(...path:string[]):string {
        return this.makeDirectory(...path);
    }


    private makeDirectory(...path:string[]):string {
        let directory = Files.join(this.options.output, ".vercel/output/functions", ...path);
        if (!fs.existsSync(directory)) {
            fs.mkdirSync(directory, { recursive: true });
        }
        return directory;
    }


    private writeEndpointConfig(path:string) {
        let buffer   = JSON.stringify(this.getEndpointConfig(), null, 3);
        let filepath = Files.join(path, "config.json");
        fs.writeFileSync(filepath, buffer);
    }


    private getEndpointConfig():Record<string, any> {
        return {
            "runtime": "edge",
            "entrypoint": "index.js"
        };
    }


    private writeRootConfig() {
        let buffer   = JSON.stringify(this.getRootConfig(), null, 3);
        let filepath = Files.join(this.options.output, ".vercel/output/config.json");
        fs.writeFileSync(filepath, buffer);
    }


    private getRootConfig():Record<string, any> {
        return {
            version: 3,
            routes: this.endpoints.filter((endpoint) => {
                return endpoint.segments.filter((segment) => segment.isDynamic).length > 0
            }).map((endpoint) => {
                return RequestUtilities.pathParamAsQueryParamRedirect(endpoint.segments);
            })
        }
    }


}


// Give careful thought to the paths for your feet and be steadfast in all
// your ways.
// - Proverbs 4:26
