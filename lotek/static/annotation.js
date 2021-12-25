const Annotation = {
    view(vnode) {
        m.route.set(vnode.attrs.record.uri + "#annotations:" + vnode.attrs.id, undefined, {replace: true});
    }
};

export const types= {annotation: Annotation};
