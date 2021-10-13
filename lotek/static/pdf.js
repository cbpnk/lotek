import {Reload} from "/static/reload.js";

const PDFForm = {
    view: function(vnode) {
        return m("dl.text-small",
                 [["Author", "pdf__author_t"],
                  ["Keyword", "pdf__keyword_t"]].map(
                      ([name, key]) =>
                      [m("dt", name),
                       (vnode.attrs.doc[key] || []).map(
                           (item) =>
                           m("dd.ml-2", item)
                       )
                      ]
                  )
                );
    }
}

class View extends Reload {
    load(vnode) {
        return () => m.request(
            {method: "GET",
             url: "/:path",
             params: {path: vnode.attrs.path},
             headers: {
                 "Accept": "text/html"
             },
             responseType: "text",
            }
        );
    }

    render(doc) {
        return [
            m("iframe",
              {style: "grid-column: 1 / span 3; height: 100%; grid-row: 3; border: none;",
               srcdoc: doc,
               onload: function(event) {
                   event.target.contentWindow.location.hash = window.location.hash;
                   const script = event.target.contentDocument.createElement("script");
                   script.src = "/static/vendor/gh/hypothesis/via@master/via/static/vendor/pdfjs-2/web/viewer.js";
                   event.target.contentDocument.head.appendChild(script);
               }
              }
             )
        ];
    }
}

export const routes = {
    "/:path.pdf": (vnode) => m(View, {key: m.route.get(), path: `${vnode.attrs.path}.pdf`}),
}

export const searches = [{name: "PDFs", query: "category_i:pdf"}];
export const categories = {
    pdf: {
        name: "PDF",
        component: PDFForm,
        readonly: true}
};
