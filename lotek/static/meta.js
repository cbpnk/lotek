const MAFF = {
    view(vnode) {
        const meta = vnode.attrs.meta;
        return html`
<dl>
<dt>Title</dt>
<dd>${meta.title_t}</dd>

<dt>Origin URL</dt>
<dd>${meta.originurl_s}</dd>

<dt>Archive Time</dt>
<dd>${meta.archive_d}Z</dd>
</dl>
`;
    }
};

const PDF = {
    view(vnode) {
        const meta = vnode.attrs.meta;
        return html`
<dl>
<dt>Title</dt>
<dd>${meta.title_t}</dd>

<dt>Author</dt>
${(meta.author_t || []).map((author) => m("dd", author))}

<dt>Keywords</dt>
${(meta.keyword_s || []).map((keyword) => m("dd", keyword))}

<dt>CreationDate</dt>
<dd>${meta.creation_d}Z</dd>

<dt>ModDate</dt>
<dd>${meta.mod_d}Z</dd>
</dl>
`;
    }
};


function is_view_available(file, allow) {
    if (!file.ext) {
        return false;
    }
    return registry.exts[file.ext]?.component;
}

const View = {
    view(vnode) {
        return m(registry.exts[vnode.attrs.file.ext].component,
                 {meta: vnode.attrs.file.meta});
    }
};

export const modes = [
    {label: "Meta",
     is_available: is_view_available,
     component: View}
];


export const registry = {
    exts: {
        md: {
            name: "Markdown",
        },
        pdf: {
            name: "PDF",
            component: PDF,
        },
        maff: {
            name: "MAFF",
            component: MAFF,
        }
    }
};
