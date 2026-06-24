import { withTheme } from '@rjsf/core';
import { generateTemplates, generateWidgets } from '@rjsf/react-bootstrap';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { getTemplate, getUiOptions } from '@rjsf/utils';
import { createContext, useContext } from 'react';
import type { CSSProperties } from 'react';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

// Propagate array-level `addable` down to each item template via context
const ArrayAddableContext = createContext(true);

// Wraps the default array field template to provide addable state to child item templates
function CustomArrayFieldTemplate(props: any) {
    const uiOptions = getUiOptions(props.uiSchema);
    const hasAdd = uiOptions.addable !== false;
    const DefaultArrayField = bootstrapTemplates.ArrayFieldTemplate;
    if (!DefaultArrayField) return <>{props.children}</>;
    return (
        <ArrayAddableContext.Provider value={hasAdd}>
            <DefaultArrayField {...props} />
        </ArrayAddableContext.Provider>
    );
}

function CustomRemoveButton(props: any) {
    const { uiSchema, registry, ...otherProps } = props;
    return (
        <Button variant='danger' size='sm' {...otherProps}>
            <DeleteIcon fontSize='small' />
        </Button>
    );
}

function CustomAddButton(props: any) {
    const { uiSchema, registry, className, ...otherProps } = props;
    return (
        <button
            type='button'
            className={className}
            {...otherProps}
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 16px',
                fontSize: '0.85rem',
                fontWeight: 600,
                fontFamily: 'inherit',
                color: '#fff',
                background: 'linear-gradient(135deg, #57a8ff 0%, #2f7df6 48%, #0d47b8 100%)',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(18, 84, 188, 0.28)',
                transition: 'box-shadow 0.2s ease',
            }}
            onMouseEnter={(e: any) => e.currentTarget.style.boxShadow = '0 6px 16px rgba(14, 75, 173, 0.36)'}
            onMouseLeave={(e: any) => e.currentTarget.style.boxShadow = '0 4px 12px rgba(18, 84, 188, 0.28)'}
        >
            <AddIcon fontSize='small' />
            Add
        </button>
    );
}

// Compact button column when array has no Add button: smaller width + left padding
function CustomArrayFieldItemTemplate(props: any) {
    const { children, buttonsProps, hasToolbar, uiSchema, registry } = props;
    const hasAdd = useContext(ArrayAddableContext);
    const ArrayFieldItemButtonsTemplate = getTemplate<'ArrayFieldItemButtonsTemplate'>('ArrayFieldItemButtonsTemplate', registry, getUiOptions(uiSchema));
    const btnStyle: CSSProperties = {
        flex: 1,
        paddingLeft: 6,
        paddingRight: 6,
        fontWeight: 'bold',
    };
    return (
        <Row className='mb-2 d-flex align-items-end' style={{ marginLeft: 0, marginRight: 0 }}>
            <Col style={{ paddingLeft: 0, paddingRight: 0, minWidth: 0, flex: '1 1 0%' }}>
                {children}
            </Col>
            <Col xs='auto' className='d-flex justify-content-end py-2' style={{ paddingLeft: hasAdd ? 0 : 12, paddingRight: 0, flex: '0 0 auto', width: hasAdd ? 120 : 52, minWidth: 0 }}>
                {hasToolbar && (
                    <ArrayFieldItemButtonsTemplate {...buttonsProps} style={btnStyle} />
                )}
            </Col>
        </Row>
    );
}

const bootstrapTemplates = generateTemplates();

const Form = withTheme({
    templates: {
        ...bootstrapTemplates,
        ArrayFieldTemplate: CustomArrayFieldTemplate,
        ArrayFieldItemTemplate: CustomArrayFieldItemTemplate,
        ButtonTemplates: {
            ...bootstrapTemplates.ButtonTemplates,
            RemoveButton: CustomRemoveButton,
            AddButton: CustomAddButton,
        },
    },
    widgets: generateWidgets(),
});

export default Form;
