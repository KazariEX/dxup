export const refactors = {
    rewrite: {
        parameter: {
            forward: {
                name: "Move parameter left",
                description: "Move parameter left",
                kind: "refactor.rewrite.parameter.forward",
            },
            backward: {
                name: "Move parameter right",
                description: "Move parameter right",
                kind: "refactor.rewrite.parameter.backward",
            },
            remove: {
                name: "Remove parameter",
                description: "Remove parameter",
                kind: "refactor.rewrite.parameter.remove",
            },
        },
    },
};
