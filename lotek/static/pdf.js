const PDFForm = {
    view: function(vnode) {
        const path = vnode.attrs.path.slice(0, -4) + ".pdf";
        return m("div.form-horizontal",
            m("div.form-group",
              m("a",
                {href: m.buildPathname("/files/:path...", {path}),
                 "class": "form-input btn btn-primary"},
                "View PDF")
             )
        );
    }
};

export const searches = [{name: "PDFs", query: "category_i:pdf"}];
export const categories = {
    pdf: {
        name: "PDF",
        component: PDFForm,
        readonly: true}
};
