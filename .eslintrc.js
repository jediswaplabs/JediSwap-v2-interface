module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    }
  },
  extends: ['airbnb', 'plugin:@typescript-eslint/recommended', 'plugin:import/typescript', 'plugin:react/recommended', 'plugin:react-hooks/recommended'],
  plugins: ['react', 'react-hooks'],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
        moduleDirectory: ['node_modules', 'src/']
      }
    }
  },
  globals: {
    document: true, window: true, Fragment: true
  },
  overrides: [{
    files: ['**/*.test.js', '**/*.test.jsx', '**/*.stories.jsx'],
    env: {
      jest: true
    },
    plugins: ['jest'],
    rules: {
      'no-console': 0,
      'jest/no-standalone-expect': 0,
      'import/no-extraneous-dependencies': 0,
      'import/no-default-export': 0
    }
  }],

  rules: {
    'arrow-parens': ['error', 'always'],
    'consistent-return': 'off',
    'func-names': ['error', 'as-needed'],
    'import/exports-last': 'off',
    'import/group-exports': 'off',
    'import/no-cycle': 'off',
    'import/extensions': 'off',
    'import/no-default-export': 'off',
    'import/no-extraneous-dependencies': 'off',
    'import/no-named-as-default': 2,
    'import/order': ['error', {
      'newlines-between': 'always',
      groups: [['builtin', 'external'], ['internal', 'parent', 'sibling', 'index']]
    }],
    'import/prefer-default-export': 'off',
    'jest/expect-expect': 'off',
    'jest/no-disabled-tests': 'off',
    'jsx-a11y/accessible-emoji': 'off',
    'jsx-a11y/alt-text': 'off',
    'jsx-a11y/anchor-has-content': 'off',
    'jsx-a11y/anchor-is-valid': 'off',
    'jsx-a11y/aria-activedescendant-has-tabindex': 'off',
    'jsx-a11y/aria-props': 'off',
    'jsx-a11y/aria-proptypes': 'off',
    'jsx-a11y/aria-role': 'off',
    'jsx-a11y/aria-unsupported-elements': 'off',
    'jsx-a11y/autocomplete-valid': 'off',
    'jsx-a11y/click-events-have-key-events': 'off',
    'jsx-a11y/heading-has-content': 'off',
    'jsx-a11y/html-has-lang': 'off',
    'jsx-a11y/iframe-has-title': 'off',
    'jsx-a11y/img-redundant-alt': 'off',
    'jsx-a11y/interactive-supports-focus': 'off',
    'jsx-a11y/label-has-associated-control': 'off',
    'jsx-a11y/media-has-caption': 'off',
    'jsx-a11y/mouse-events-have-key-events': 'off',
    'jsx-a11y/no-access-key': 'off',
    'jsx-a11y/no-autofocus': 'off',
    'jsx-a11y/no-distracting-elements': 'off',
    'jsx-a11y/no-interactive-element-to-noninteractive-role': 'off',
    'jsx-a11y/no-noninteractive-element-interactions': 'off',
    'jsx-a11y/no-noninteractive-element-to-interactive-role': 'off',
    'jsx-a11y/no-noninteractive-tabindex': 'off',
    'jsx-a11y/no-onchange': 'off',
    'jsx-a11y/no-redundant-roles': 'off',
    'jsx-a11y/no-static-element-interactions': 'off',
    'jsx-a11y/role-has-required-aria-props': 'off',
    'jsx-a11y/role-supports-aria-props': 'off',
    'jsx-a11y/scope': 'off',
    'jsx-a11y/tabindex-no-positive': 'off',
    '@typescript-eslint/ban-ts-ignore': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    '@typescript-eslint/no-empty-function': 'off',
    'react/jsx-filename-extension': 'off',
    'max-len': 'off',
    'max-params': ['error', 3],
    'no-await-in-loop': 'off',
    'no-cond-assign': 'off',
    'no-console': 'off',
    'no-continue': 'off',
    'no-delete-var': 'error',
    'no-empty': 0,
    'no-extra-boolean-cast': 0,
    'no-plusplus': 'off',
    'no-prototype-builtins': 'off',
    'no-nested-ternary': 'off',
    'no-restricted-properties': 'off',
    'no-restricted-syntax': 'off',
    'no-promise-executor-return': 'off',
    'no-unused-vars': ['off', {
      varsIgnorePattern: 'Fragment', ignoreRestSiblings: true
    }],
    'linebreak-style': 0,
    '@typescript-eslint/no-unused-vars': 'off',
    'no-use-before-define': 'off',
    'object-curly-newline': ['error', {
      ObjectExpression: { consistent: true },
      ObjectPattern: 'never',
      ImportDeclaration: 'never',
      ExportDeclaration: {
        multiline: true, minProperties: 3
      }
    }],
    'object-curly-spacing': ['error', 'always', {

      arraysInObjects: true, objectsInObjects: true
    }],
    'react-hooks/exhaustive-deps': 0, // Checks effect dependencies
    'react-hooks/rules-of-hooks': 'error',
    'react/button-has-type': 'off',
    'react/destructuring-assignment': 'off',
    'react/display-name': 0,
    'react/forbid-prop-types': 'off',
    'react/function-component-definition': 'off',
    'react/jsx-curly-brace-presence': 'off',
    'react/jsx-first-prop-new-line': 'off',
    'react/jsx-fragments': 'off',
    'react/jsx-one-expression-per-line': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/jsx-uses-react': 1,
    'react/jsx-uses-vars': 1,
    'react/no-array-index-key': 'off',
    'react/no-did-update-set-state': 'off',
    'react/no-unused-state': 'off',
    'react/prop-types': [2, { skipUndeclared: true }],
    'react/react-in-jsx-scope': 0,
    'react/require-default-props': 0,
    'require-atomic-updates': 'off',
    'require-await': 2,
    camelcase: 'error',
    curly: ['error', 'all'],
    'default-param-last': 'off',
    indent: ['error', 2, { SwitchCase: 1 }],
    quotes: ['error', 'single'],
    semi: ['error', 'never'],
    'comma-dangle': ['error', 'never']
  }
}
