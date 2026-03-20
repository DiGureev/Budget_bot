export function getCategoryButtonLabel(category, user) {
    const spent = formatAmount(category.currentSpent || 0);
    const budget = formatAmount(category.currentBudget || 0);
  
    const isDefault =
      user?.defaultCategoryId &&
      String(user.defaultCategoryId) === String(category._id);
  
    return `${category.name} ${spent}/${budget}${isDefault ? ' (default) ⭐' : ''}`;
  }
  
  export function categoriesReplyKeyboard(categories, user) {
    const rows = categories.map((category) => [getCategoryButtonLabel(category, user)]);
  
    if (categories.length < 8) {
      rows.push(['➕ Add category']);
    }
  
    return {
      keyboard: rows,
      resize_keyboard: true,
      one_time_keyboard: false,
    };
  }
  
  export function categoryActionsKeyboard(category) {
    return {
      inline_keyboard: [
        [
          { text: 'History', callback_data: `history:${category._id}` },
          { text: 'Edit', callback_data: `edit:${category._id}` },
          { text: 'Remove', callback_data: `remove:${category._id}` },
        ],
      ],
    };
  }
  
  export function confirmCategoryTypeKeyboard(selectedType) {
    const opposite = selectedType === 'annual' ? 'monthly' : 'annual';
  
    return {
      inline_keyboard: [
        [{ text: 'Confirm', callback_data: `confirm_cat_type:${selectedType}` }],
        [{ text: `Set as ${capitalize(opposite)}`, callback_data: `cat_type:${opposite}` }],
      ],
    };
  }
  
  export function defaultChoiceKeyboard(categoryId) {
    return {
      inline_keyboard: [
        [
          { text: 'Yes', callback_data: `default_yes:${categoryId}` },
          { text: 'No', callback_data: `default_no:${categoryId}` },
        ],
      ],
    };
  }
  
  export function editCategoryKeyboard(category, isDefault) {
    const rows = [
      [{ text: 'Rename', callback_data: `edit_rename:${category._id}` }],
      [{ text: 'Update budget', callback_data: `edit_budget:${category._id}` }],
      [{ text: 'Reset spend to 0', callback_data: `edit_reset:${category._id}` }],
    ];
  
    if (category.type === 'annual') {
      rows.push([
        { text: 'Convert to Monthly', callback_data: `edit_convert_to_monthly:${category._id}` },
      ]);
    }
  
    if (category.type === 'monthly') {
      rows.push([
        {
          text: isDefault ? 'Unset default ⭐' : 'Set as default ⭐',
          callback_data: isDefault
            ? `unset_default:${category._id}`
            : `set_default:${category._id}`,
        },
      ]);
    }
  
    rows.push([{ text: '⬅️ Back', callback_data: `open_category:${category._id}` }]);
  
    return {
      inline_keyboard: rows,
    };
  }
  
  export function confirmRemoveKeyboard(categoryId) {
    return {
      inline_keyboard: [
        [
          { text: 'Yes, remove', callback_data: `confirm_remove:${categoryId}` },
          { text: 'Cancel', callback_data: `open_category:${categoryId}` },
        ],
      ],
    };
  }
  
  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
  
  function formatAmount(value) {
    const num = Number(value || 0);
    return Number.isInteger(num) ? String(num) : num.toFixed(2);
  }