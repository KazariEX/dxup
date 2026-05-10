const vueRE = /[?&]vue(?:&|$)/;
const typeRE = /[?&]type=[^&]*/;

export function isVue(id: string) {
    const index = id.indexOf("?");
    const query = index !== -1 ? id.slice(index) : void 0;

    if (query === void 0) {
        return id.endsWith(".vue");
    }

    if (query === "?macro=true") {
        return true;
    }

    if (!vueRE.test(query)) {
        return false;
    }

    if (typeRE.test(query)) {
        return false;
    }

    return true;
}
