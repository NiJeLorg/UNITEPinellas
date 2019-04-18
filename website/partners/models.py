from django.db import models
from django import forms

from modelcluster.fields import ParentalManyToManyField
from wagtail.core.models import Page
from wagtail.core.fields import RichTextField
from wagtail.admin.edit_handlers import FieldPanel
from wagtail.images.edit_handlers import ImageChooserPanel
from wagtail.search import index


class PartnerIndexPage(Page):
    intro = RichTextField(blank=True)

    def get_context(self, request):
        # Update context to include only published posts, ordered by reverse-chron
        context = super().get_context(request)
        partnerpages = self.get_children().live()
        context['partnerpages'] = partnerpages
        return context

class PartnerCategories(models.Model):
    category = models.CharField(max_length=250)

    class Meta:
        ordering = ('category',)

    def __str__(self):
        return self.category    

class PartnerPage(Page):
    date = models.DateField("Post date")
    name = models.CharField(max_length=250)
    logo = models.ForeignKey(
        'wagtailimages.Image',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='+'
    )
    website = models.URLField()
    category = ParentalManyToManyField(PartnerCategories, blank=False)

    search_fields = Page.search_fields + [
        index.SearchField('name'),
    ]

    content_panels = Page.content_panels + [
        FieldPanel('date'),
        FieldPanel('name'),
        ImageChooserPanel('logo'),
        FieldPanel('website'),
        FieldPanel('category', widget=forms.CheckboxSelectMultiple)
    ]