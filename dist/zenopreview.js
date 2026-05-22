// Function to remove specific properties from inline styles
function removeInlineStyleProperties(elements, propertiesToRemove) {
    elements.forEach(function(element) {
        if(element.hasAttribute('style')) {
            const currentStyle = element.getAttribute('style');
            if(currentStyle) {
                // Parse the style string and remove specified properties
                // Split by semicolon and filter out empty strings
                const stylePairs = currentStyle.split(';')
                    .map(s => s.trim())
                    .filter(s => s && s.includes(':')); // Ensure it has a property:value format
                
                // Filter out properties that should be removed
                const newStylePairs = stylePairs.filter(function(pair) {
                    const colonIndex = pair.indexOf(':');
                    if(colonIndex === -1) return true; // Keep malformed pairs
                    const prop = pair.substring(0, colonIndex).trim().toLowerCase();
                    return !propertiesToRemove.includes(prop);
                });
                
                if(newStylePairs.length === 0) {
                    // Remove the style attribute entirely if no properties remain
                    element.removeAttribute('style');
                } else {
                    // Rebuild the style attribute without the removed properties
                    element.setAttribute('style', newStylePairs.join('; '));
                }
            }
        }
    });
}

// Function to remove entire style attribute from elements
function removeInlineStyles(elements) {
    elements.forEach(function(element) {
        element.removeAttribute('style');
    });
}

// Function to override inline styles with custom CSS rules
function applyCustomCssOverrides(customCssData) {
    // Always apply CSS rules from the custom-page-css stylesheet
    const styleSheet = document.getElementById('custom-page-css');
    if(styleSheet && styleSheet.sheet) {
        try {
            const rules = styleSheet.sheet.cssRules || styleSheet.sheet.rules;
            if(rules && rules.length > 0) {
                // Process each CSS rule: remove conflicting inline styles, then apply custom CSS
                for(let i = 0; i < rules.length; i++) {
                    const rule = rules[i];
                    if(rule.style && rule.selectorText) {
                        const selector = rule.selectorText.trim();
                        try {
                            const elements = document.querySelectorAll(selector);
                            
                            // Collect properties to remove from inline styles
                            const propertiesToRemove = [];
                            const propertiesToApply = {};
                            
                            for(let j = 0; j < rule.style.length; j++) {
                                const prop = rule.style[j];
                                const value = rule.style.getPropertyValue(prop);
                                if(value) {
                                    propertiesToRemove.push(prop.toLowerCase());
                                    propertiesToApply[prop] = value;
                                }
                            }
                            
                            // Step 1: Remove conflicting properties from inline styles
                            if(propertiesToRemove.length > 0) {
                                removeInlineStyleProperties(elements, propertiesToRemove);
                            }
                            
                            // Step 2: Apply custom CSS properties with !important
                            elements.forEach(function(element) {
                                Object.keys(propertiesToApply).forEach(function(prop) {
                                    element.style.setProperty(prop, propertiesToApply[prop], 'important');
                                });
                            });
                        } catch(e) {
                            console.warn('Error processing selector:', selector, e);
                        }
                    }
                }
            }
        } catch(e) {
            // If CSS parsing fails (e.g., CORS issues), fall back to regex-based parsing
            console.warn('Could not parse CSS rules via stylesheet API, using fallback method:', e);
            if(customCssData && customCssData.customCss) {
                applyCustomCssFallback(customCssData.customCss);
            }
        }
    }
}

// Fallback method: Parse CSS manually, remove inline styles, then apply
function applyCustomCssFallback(css) {
    // Simple regex-based CSS rule parser
    const ruleRegex = /([^{]+)\{([^}]+)\}/g;
    let match;
    const rules = [];
    
    // Collect all rules first
    while((match = ruleRegex.exec(css)) !== null) {
        const selector = match[1].trim();
        const declarations = match[2].trim();
        const properties = {};
        
        // Parse each declaration
        const declRegex = /([^:]+):\s*([^;!]+)(\s*!important)?/g;
        let declMatch;
        while((declMatch = declRegex.exec(declarations)) !== null) {
            const prop = declMatch[1].trim();
            const value = declMatch[2].trim();
            properties[prop] = value;
        }
        
        if(Object.keys(properties).length > 0) {
            rules.push({ selector: selector, properties: properties });
        }
    }
    
    // Apply rules: remove inline styles first, then apply custom CSS
    rules.forEach(function(rule) {
        try {
            const elements = document.querySelectorAll(rule.selector);
            const propertiesToRemove = Object.keys(rule.properties).map(p => p.toLowerCase());
            
            // Remove conflicting inline style properties
            removeInlineStyleProperties(elements, propertiesToRemove);
            
            // Apply custom CSS properties
            elements.forEach(function(element) {
                Object.keys(rule.properties).forEach(function(prop) {
                    element.style.setProperty(prop, rule.properties[prop], 'important');
                });
            });
        } catch(e) {
            console.warn('Error applying fallback CSS rule:', rule.selector, e);
        }
    });
}

// Apply background colors to override Tailwind classes and test CSS
function applyBackgroundColors(backgroundColors) {
    if(backgroundColors && backgroundColors.bodyBgColor) {
        const body = document.body;
        if(body) {
            // Remove background properties from all CSS rules that might interfere
            const customCssStyle = document.getElementById('custom-page-css');
            if(customCssStyle && customCssStyle.sheet) {
                try {
                    const rules = customCssStyle.sheet.cssRules || customCssStyle.sheet.rules;
                    if(rules) {
                        for(let i = 0; i < rules.length; i++) {
                            const rule = rules[i];
                            if(rule.selectorText && (rule.selectorText === 'body' || rule.selectorText.includes('body'))) {
                                // Remove background-color and background from the rule
                                rule.style.removeProperty('background-color');
                                rule.style.removeProperty('background');
                            }
                        }
                    }
                } catch(e) {
                    // CORS or other errors, continue with inline style removal
                }
            }
            
            // Remove any existing background-color from inline styles first
            if(body.hasAttribute('style')) {
                const currentStyle = body.getAttribute('style');
                if(currentStyle) {
                    // Remove background-color and background properties
                    const newStyle = currentStyle
                        .split(';')
                        .map(s => s.trim())
                        .filter(s => s && !s.toLowerCase().startsWith('background-color') && !s.toLowerCase().startsWith('background:'))
                        .join('; ');
                    if(newStyle) {
                        body.setAttribute('style', newStyle + '; ');
                    } else {
                        body.removeAttribute('style');
                    }
                }
            }
            // Apply the selected background color with !important (this overrides everything)
            body.style.setProperty('background-color', backgroundColors.bodyBgColor, 'important');
            // Also set background shorthand to ensure it's applied
            body.style.setProperty('background', backgroundColors.bodyBgColor, 'important');
        }
    }
    
    if(backgroundColors && backgroundColors.cardBgColor) {
        const container = document.getElementById('page-container');
        if(container) {
            // Remove background-color from CSS rules targeting .container or #page-container
            const customCssStyle = document.getElementById('custom-page-css');
            if(customCssStyle && customCssStyle.sheet) {
                try {
                    const rules = customCssStyle.sheet.cssRules || customCssStyle.sheet.rules;
                    if(rules) {
                        for(let i = 0; i < rules.length; i++) {
                            const rule = rules[i];
                            if(rule.selectorText && (rule.selectorText.includes('.container') || rule.selectorText.includes('#page-container'))) {
                                rule.style.removeProperty('background-color');
                            }
                        }
                    }
                } catch(e) {
                    // Continue with inline style removal
                }
            }
            
            // Remove any existing background-color from inline styles first
            if(container.hasAttribute('style')) {
                const currentStyle = container.getAttribute('style');
                if(currentStyle) {
                    // Remove background-color property
                    const newStyle = currentStyle
                        .split(';')
                        .map(s => s.trim())
                        .filter(s => s && !s.toLowerCase().startsWith('background-color'))
                        .join('; ');
                    if(newStyle) {
                        container.setAttribute('style', newStyle + '; ');
                    } else {
                        container.removeAttribute('style');
                    }
                }
            }
            // Apply the selected background color with !important
            container.style.setProperty('background-color', backgroundColors.cardBgColor, 'important');
        }
    }
}

// Apply custom CSS overrides after DOM and all styles are loaded
function initializeCustomCss(customCssData, backgroundColors) {
    applyBackgroundColors(backgroundColors);
    applyCustomCssOverrides(customCssData);
}

// Initialize preview functionality
function initializePreview(customCssData, backgroundColors) {
    // Try multiple times to ensure it works after Tailwind and all styles load
    document.addEventListener('DOMContentLoaded', function() {
        applyBackgroundColors(backgroundColors);
        setTimeout(function() {
            initializeCustomCss(customCssData, backgroundColors);
        }, 100);
        setTimeout(function() {
            initializeCustomCss(customCssData, backgroundColors);
        }, 500);
        setTimeout(function() {
            initializeCustomCss(customCssData, backgroundColors);
        }, 1000);
    });
    
    // Also try after window load
    window.addEventListener('load', function() {
        applyBackgroundColors(backgroundColors);
        setTimeout(function() {
            initializeCustomCss(customCssData, backgroundColors);
        }, 100);
        setTimeout(function() {
            initializeCustomCss(customCssData, backgroundColors);
        }, 500);
    });
}

