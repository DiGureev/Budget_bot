const WELCOME_MESSAGE = `
<b>Welcome to the Spending Mirror Bot!</b>\n\nOur goal is to help you manage your monthly and annual spending. Please enter your <b>email</b> to create an account.
`;

const ACCOUNT_CREATED_MESSAGE = `Account is created 🎉\n\nNext step is to create categories that you want to track. You can add up to 8 categories. 🚀`
const ADD_NEW_CATEGORY_MESSAGE = '➕ Add new category'
const EMAIL_VALIDATION_ERROR = 'Please enter a valid email address.'
const EMAIL_SAVE_ERROR = 'Could not save your email. Please try again.'

const BOT_STARTED_MESSAGE = 'The bot is started.'

const ADD_CATEGORY_ERROR = 'You can add up to 8 categories.'
const ENTER_CATEGORY_NAME_MESSAGE = 'Enter a name for your new category. Feel free to include emojis. You will be able to edit it later.'
const CATEGORY_NAME_EXISTS_ERROR = 'A category with this exact name already exists. Please choose another name.'
const CREATE_CATEGORY_ERROR = `Could not create category. Please try again.`

const CATEGORY_TYPE_CHOICE_MESSAGE = `Is it an annual category or a monthly one?\n\nIf it's <b>monthly</b>, we will track your spending throughout the month, and it will reset on the first day of every month.\n\nFor an <b>annual</b> category, we will track the sum you set for this category throughout the year.`

const CATEGORY_BUDGET_VALIDATION_ERROR = 'Please enter a valid positive budget.'

const CATEGORY_CREATED_MESSAGE = (categoryName, amount, type = 'monthly') => {
    const typeText = type === 'monthly' ? 'a monthly' : 'an annual';
    return `The "${categoryName}" category is saved with ${typeText} budget of ${amount} shekels.`
}
const MAKE_DEFAULT_CATEGORY_MESSAGE = (categoryName, amount) => {
    return `${CATEGORY_CREATED_MESSAGE(categoryName, amount)}\n\nWould you like to set "${categoryName}" as the <b>default</b> category?\n\nDefault means the next time you simply send 200 to the bot, and it will go straight to the "${categoryName}" category — you won't need to select a category before adding the expense.\n\nThis is useful for the category you spend on daily.\n\nYou can change it later.`
}

const DEFAULT_CATEGORY_SET_MESSAGE = (categoryName) => {
    return `Category "${categoryName}" set as default ⭐. Now when you enter an amount without choosing a category it will be added to “${categoryName}”.`
}

const AMOUNT_VALIDATION_ERROR = 'Please send a valid amount like 300, 30.10 or 30,10 or -300, -30.10 or -30,10 for refund.'
const CATEGORY_NOT_FOUND_ERROR = 'Category not found.'

const NOT_DEFAULT_CATEGORY_ERROR = "You didn't choose default category. Please select the category before sending the sum."

export {
    WELCOME_MESSAGE,
    ACCOUNT_CREATED_MESSAGE,
    ADD_NEW_CATEGORY_MESSAGE,
    EMAIL_VALIDATION_ERROR,
    EMAIL_SAVE_ERROR,
    BOT_STARTED_MESSAGE,
    ADD_CATEGORY_ERROR,
    ENTER_CATEGORY_NAME_MESSAGE,
    CATEGORY_NAME_EXISTS_ERROR,
    CREATE_CATEGORY_ERROR,
    CATEGORY_TYPE_CHOICE_MESSAGE,
    CATEGORY_BUDGET_VALIDATION_ERROR,
    CATEGORY_CREATED_MESSAGE,
    MAKE_DEFAULT_CATEGORY_MESSAGE,
    DEFAULT_CATEGORY_SET_MESSAGE,
    AMOUNT_VALIDATION_ERROR,
    CATEGORY_NOT_FOUND_ERROR,
    NOT_DEFAULT_CATEGORY_ERROR,
}