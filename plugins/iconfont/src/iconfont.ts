import { Plugin, ListItem } from "utools-helper";
import Axios, { AxiosInstance } from "axios";
import { stringify } from "querystring";
import { writeFileSync } from "fs";
import { join } from "path";

interface keywordParams {
  [index: string]: { key: string; val: any };
}

const keywordParams: keywordParams = {
  精选: { key: "fromCollection", val: 1 },
  单色: { key: "fills", val: 0 },
  多色: { key: "fills", val: 1 },
  线性: { key: "line", val: 1 },
  面性: { key: "fill", val: 1 },
  扁平: { key: "flat", val: 1 },
  手绘: { key: "hand", val: 1 },
  简约: { key: "simple", val: 1 },
  精美: { key: "complex", val: 1 },
};

export class Iconfont implements Plugin {
  code = "iconfont";
  request: AxiosInstance;
  ctoken: string;

  async enter(): Promise<ListItem[]> {
    let request = Axios.create({
      baseURL: "https://www.iconfont.cn",
      timeout: 10000,
      xsrfCookieName: "ctoken",
      xsrfHeaderName: "x-csrf-token",
      withCredentials: true,
      adapter: require("axios/lib/adapters/http.js"),
    });
    let res = await request.get("/");
    let cookies = res.headers["set-cookie"] as Array<string>;
    let csrf: string;
    let cookie2 = "";
    cookies.forEach((cookie) => {
      cookie2 += cookie.split(";")[0] + ";";
      if (cookie.includes("ctoken")) {
        csrf = cookie.match(/ctoken=(.*?);/)[1];
        this.ctoken = csrf;
      }
    });
    request.defaults.headers = {
      cookie: cookie2,
      "x-csrf-token": csrf,
    };
    this.request = request;
    return this.search("icon");
  }

  async search(keyword: string): Promise<ListItem[]> {
    let words = keyword.trim().split(/\s+/g);
    console.log(keyword, words);

    const r = await this.request.post(
      "api/icon/search.json",
      stringify(this.params(words)),
      {
        headers: {
          "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
        },
      }
    );

    let icons = r.data.data.icons.map((icon: any) => {
      return {
        id: icon.id,
        title: icon.name.trim().replace(/\s+/g, "_"),
        description: "回车查看更多选项",
        icon: "data:image/svg+xml;utf8," + encodeURIComponent(icon.show_svg),
        data: icon.show_svg,
        searchUrl:
          "https://www.iconfont.cn/search/index?searchType=icon&q=" + keyword,
        operate: "show_operate",
      };
    });
    return icons;
  }

  params(words: string[]): any {
    let data: any = {
      page: 1,
      pageSize: 20,
      t: new Date().getTime(),
      q: words[0],
      sortType: "updated_at",
      ctoken: this.ctoken,
    };
    if (words.length >= 2) {
      words.forEach((word, index) => {
        if (index == 0) return;
        let keyParams = keywordParams[word];
        if (keyParams) data[keyParams.key] = keyParams.val;
      });
    }
    return data;
  }

  async loadImg(src: string): Promise<HTMLImageElement> {
    let img = document.createElement("img");
    return new Promise((resolve, reject) => {
      img.onload = () => resolve(img);
      img.src = src;
    });
  }

  async svg2png(id: Number, data: string): Promise<string> {
    return (await this.svg2canvas(id, data)).toDataURL("image/png");
  }

  async svg2canvas(id: Number, data: string): Promise<HTMLCanvasElement> {
    let canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 300;
    canvas.id = "id-" + id;
    let ctx = canvas.getContext("2d");
    let img = await this.loadImg(data);
    ctx.drawImage(img, 0, 0);
    return canvas;
  }

  async select(item: ListItem): Promise<ListItem[]> {
    let items: ListItem[] = [
      {
        title: "下载-SVG",
        description: item.title,
        data: item.data,
        icon: "icon/download.svg",
        operate: "download",
      },
      {
        title: "下载-PNG",
        description: item.title,
        data: item.icon,
        id: item.id,
        icon: "icon/download.svg",
        operate: "download_png",
      },
      {
        title: "复制-SVG",
        description: item.title,
        data: item.data,
        icon: "icon/copy.svg",
        operate: "copy",
      },
      {
        title: "打开浏览器查看搜索结果",
        description: item.title,
        data: item.searchUrl,
        icon: "icon/browser.svg",
        operate: "open",
      },
    ];
    switch (item.operate) {
      case "show_operate":
        return items;
      case "download":
        let path = join(utools.getPath("downloads"), item.description + ".svg");
        writeFileSync(path, item.data);
        utools.showNotification("文件已保存到下载目录");
        break;
      case "copy":
        utools.copyText(item.data);
        utools.showNotification("svg 已复制到剪切板");
        break;
      case "open":
        utools.shellOpenExternal(item.data);
        break;
      case "download_png":
        // 创建隐藏的可下载链接
        var eleLink = document.createElement("a");
        eleLink.download = item.description + ".png";
        eleLink.style.display = "none";
        // 字符内容转变成blob地址
        eleLink.href = await this.svg2png(item.id, item.data);
        // 触发点击
        document.body.appendChild(eleLink);
        eleLink.click();
        // 然后移除
        document.body.removeChild(eleLink);
        break;
      default:
        utools.showNotification("未知操作");
        break;
    }
    utools.hideMainWindow();
    utools.outPlugin();
  }
}
