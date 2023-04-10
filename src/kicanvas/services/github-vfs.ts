/*
    Copyright (c) 2023 Alethea Katherine Flowers.
    Published under the standard MIT License.
    Full text available at: https://opensource.org/licenses/MIT
*/

import { initiate_download } from "../../base/dom/download";
import { basename } from "../../base/paths";
import { GitHubUserContent } from "./github";
import { VirtualFileSystem } from "./vfs";

const gh_user_content = new GitHubUserContent();

/**
 * Virtual file system for GitHub.
 */
export class GitHubFileSystem extends VirtualFileSystem {
    constructor(private files_to_urls: Map<string, URL>) {
        super();
    }

    public static async fromURLs(...urls: (string | URL)[]) {
        // Handles URLs like this:
        // https://github.com/wntrblm/Helium/blob/main/hardware/board/board.kicad_sch

        const files_to_urls = new Map();

        for (const url of urls) {
            const guc_url = gh_user_content.convert_url(url);
            const name = basename(guc_url);
            files_to_urls.set(name, guc_url);
        }

        return new GitHubFileSystem(files_to_urls);
    }

    public override *list() {
        yield* this.files_to_urls.keys();
    }

    public override get(name: string): Promise<File> {
        const url = this.files_to_urls.get(name);

        if (!url) {
            throw new Error(`File ${name} not found!`);
        }

        return gh_user_content.get(url);
    }

    public override has(name: string) {
        return Promise.resolve(this.files_to_urls.has(name));
    }

    public override async download(name: string) {
        // Note: we can't just use the GitHub URL to download since the anchor
        // tag method used by initiate_download() only works for same-origin
        // or data: urls, so this actually fetch()s the file and then initiates
        // the download.
        initiate_download(await this.get(name));
    }
}