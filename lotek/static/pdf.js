const PDFForm = {
    view: function(vnode) {
        return m(
            "dl.text-small",
            [["Author", "author_t"],
             ["Keyword", "keyword_t"]].map(
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

export const searches = [{name: "PDFs", query: "category_i:pdf"}];
export const categories = {
    pdf: {
        name: "PDF",
        component: PDFForm,
        readonly: true}
};
