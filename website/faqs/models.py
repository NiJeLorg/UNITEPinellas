from django.db import models

from wagtail.core.models import Page
from wagtail.core.fields import RichTextField
from wagtail.admin.edit_handlers import FieldPanel
from wagtail.search import index


class FaqIndexPage(Page):
    intro = RichTextField(blank=True)

    def get_context(self, request):
        # Update context to include only published posts, ordered by reverse-chron
        context = super().get_context(request)
        faqpages = self.get_children().live()
        context['faqpages'] = faqpages
        return context

class FaqPage(Page):
    date = models.DateField("Post date")
    question = models.CharField(max_length=250, blank=False)
    answer = RichTextField(blank=False)

    search_fields = Page.search_fields + [
        index.SearchField('question'),
        index.SearchField('answer'),
    ]

    content_panels = Page.content_panels + [
        FieldPanel('date'),
        FieldPanel('question'),
        FieldPanel('answer'),
    ]